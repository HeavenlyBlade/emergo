# EMERGO Development Plan
**Mobile Emergency Response Application with Location Sharing — Barangay Marketview, Lucena City**
Built with Kiro (spec-driven AI coding agent), following the Agile methodology from Chapter 3.

---

## 1. How This Plan Works

Your thesis already commits you to Agile phases: **Planning → Analysis → Design → Development → Testing → Deployment**. Kiro's native workflow (per module: `requirements.md` → `design.md` → `tasks.md`) is essentially a formalized Design→Development bridge — so this plan nests Kiro specs *inside* your Agile phases rather than replacing them. That keeps your Chapter 3 methodology intact for the panel while giving you a working build process.

Each feature module becomes **one Kiro spec**. You write/approve `requirements.md` and `design.md` yourself (or with Kiro's help) before letting Kiro generate `tasks.md` and implement — this is what keeps the AI from wandering off and producing code that doesn't match your architecture.

---

## 2. Phase 0 — Environment & Project Setup (Week 1)

Before opening Kiro, get the skeleton in place so specs have something real to point at.

- [ ] Create two repos (or a monorepo): `emergo-mobile` (Expo/React Native + TypeScript) and `emergo-dashboard` (React + Vite)
- [ ] Initialize Firebase project: enable Authentication (Phone Number provider), Cloud Firestore, and Hosting. The free **Spark plan is sufficient** — no billing upgrade required. In the Firebase console, also set up **test phone numbers** (Authentication → Sign-in method → Phone → Test phone numbers) so you can develop without burning the 10 SMS/day free-tier limit.
- [ ] Set up Google Maps Platform: Maps SDK (mobile) + Geocoding API, restrict API keys by app/package
- [ ] Install Kiro, open both repos, and write a **steering file** for each (`.kiro/steering/`). Each steering file should cover: tech stack, folder conventions, naming conventions, and the system-wide invariants below. Because you have two separate repos, copy the invariants section **verbatim** into both — word-for-word, not paraphrased — so that specs generated weeks apart in different repos stay architecturally consistent. Add a note at the top of each file pointing to its counterpart (e.g., *"See also: emergo-dashboard steering for dashboard-side conventions"*).

  **System-Wide Invariants to include in both steering files (copy exactly):**
  ```
  ## System-Wide Invariants (enforce in every spec)
  - Authentication is Phone Number (OTP) only — no email/password. On first login, create users/{uid} with role: 'resident' by default. Officials and tanods have their role set manually by the admin. Never allow self-assignment of role: 'official' or role: 'tanod'.
  - Notifications use Expo Push API — no Cloud Functions, no FCM, no Blaze plan. All official/tanod devices are peers — none is primary or acts as a relay.
  - Only a user with role == 'official' may write status: 'verified' to any incident document.
  - This role check MUST be enforced in firestore.rules, not only in UI logic.
  - The app will not queue emergency reports offline. If the device has no connection at submission time, the user sees a clear error prompt and must retry manually.
  ```

  Steering files persist across every spec session, so encoding these constraints once here prevents drift between modules built weeks apart.
- [ ] **Expo Push Notifications spike** — do this before any spec work begins:
  - Install `expo-notifications` in the mobile project
  - Request notification permissions and retrieve an Expo push token from a physical device (tokens don't work on simulators)
  - Send a test push to that token using the [Expo Push Tool](https://expo.dev/notifications) or a direct POST to `https://exp.host/--/api/v2/push/send`
  - Confirm the notification arrives on the device
  - The goal is to confirm the Expo push pipeline works end-to-end before Module 5 depends on it. If tokens aren't generating (common issue: physical device required, `projectId` must match your EAS project), resolve it in Week 1.
- [ ] Set up Figma workspace and a shared component/style reference (this feeds Kiro's design specs later)
- [ ] Set up a shared task board (Trello/Notion/GitHub Projects) mirroring the module list in Section 4 — useful evidence for your methodology narrative too

---

## 3. Phase 1 — Planning (Weeks 2–3)

Maps to your thesis's "Planning" sub-phase: confirm core features and stack feasibility.

- [ ] Finalize the feature list per module (Section 4) against your Statement of the Problem — every feature should trace back to a specific problem/objective
- [ ] Confirm Firebase free-tier limits are sufficient for your pilot scale (~30 residents, 5 officials)
- [ ] Spike-test the riskiest technical assumption early: get one GPS coordinate from the Expo app into Firestore, store an Expo push token in the `users` document, and trigger a test push notification that arrives on a second physical device. This is a throwaway proof-of-concept, not a Kiro spec — it de-risks the entire notification architecture before you commit weeks to it.
- [ ] Lock the MVP scope: which features are required for defense vs. "nice to have if time allows"

---

## 4. Phase 2 — Analysis (Weeks 3–5)

Maps to your thesis's "Analysis" sub-phase: this is also where each Kiro spec's `requirements.md` gets written.

Interview data from barangay officials/tanods/residents feeds directly into each module's requirements doc. Updated module breakdown (each = one Kiro spec):

| # | Module | Primary users | Core requirement source |
|---|--------|---------------|--------------------------|
| 1 | Authentication & Role-Based Accounts | Residents, Officials, Tanods | Firebase Phone Number Auth (OTP via SMS) — all roles use phone login; `role` field (`resident` / `official` / `tanod`) in `users/{uid}`; residents get `role: 'resident'` on first login; officials/tanods have role set manually by admin before pilot |
| 2 | Emergency Alert (one-tap report) | Residents | Definition of Terms: "Emergency Alert" |
| 3 | GPS Location Capture & Sharing | Residents | "GPS Location Sharing" |
| 4 | Incident Data Model & Status Lifecycle | System | `status: 'unverified' \| 'verified' \| 'resolved'` — the core state machine everything else reads from |
| 5 | Notification Fan-Out (Expo Push API) | Officials, Tanods | On login, official/tanod devices store an Expo push token in `users/{uid}.expoPushToken`. When a resident submits an alert, the app queries Firestore for all official/tanod tokens and sends a batch push via the Expo Push API (`expo-notifications`) — no Cloud Functions, no FCM, no Blaze plan required |
| 6 | Dashboard Live Map | Officials, Tanods | Google Maps JS API (not mobile SDK) + real-time Firestore listener for `incidents`; status-differentiated pins (unverified = pulsing outline, verified = solid, resolved = gray); incident detail panel — complex enough to be its own spec separate from Module 5 |
| 7 | Barangay Official & Tanod Dashboard — List & Detail Panel | Officials, Tanods | "Barangay Official Dashboard" — incident list view, detail panel, and status actions; consumes the real-time listener from Module 6 |
| 8 | Incident Verification & Resolution | Officials only | Response Time measurement; verification write is role-gated to officials |
| 9 | Admin/Records (history, reporting) | Officials | Significance: "centralized record... future planning" |

For each module, before opening Kiro: write 2–4 user stories with acceptance criteria (EARS-style: "WHEN [event] THE SYSTEM SHALL [response]"). This becomes the seed for Kiro's `requirements.md`. For Module 8 specifically, write the acceptance criteria explicitly around the role gate, e.g.: "WHEN a user with role != official attempts to set status to verified, THE SYSTEM SHALL reject the write" — spelling this out up front means Kiro's generated design doc treats it as a hard requirement, not an afterthought.

---

## 5. Phase 3 — Design (Weeks 5–7)

Maps to your thesis's "Design" sub-phase: data model, architecture, UI.

- [ ] **Firestore schema**, decided:
  - `users/{uid}`: `role: 'resident' | 'official' | 'tanod'`, `displayName`, `phoneNumber`, `createdAt`, `expoPushToken?`
  - `incidents/{id}`: `status: 'unverified' | 'verified' | 'resolved'`, `reportedAt`, `reportedBy`, `location` (GeoPoint), `verifiedBy`, `verifiedAt`, `resolvedAt`
- [ ] **Firestore security rules**, decided constraints to encode:
  - Any authenticated resident can create an incident, only for themselves
  - Any authenticated official/tanod can read all incidents (peers, no device hierarchy)
  - Only `role == 'official'` can update `status` from `unverified` to `verified` — enforce this in the rules, not just hidden in the UI, since a rules-only check is the actual security boundary
  - Wrap the verify transition in a Firestore transaction that checks `status == 'unverified'` before writing, so two officials tapping "verify" within the same second don't both silently "win" — the second write should fail with a clear "already verified by [name]" instead
- [ ] **Offline behavior decision (Option B — Block with error):** The app will not queue emergency reports offline. If the device has no connection at the moment the resident taps the alert button, display a clear error prompt: *"No connection. Move to an area with signal and try again."* No silent queueing, no background retry. This decision must be written into the Module 2 (Emergency Alert) `design.md` explicitly so Kiro treats it as a hard requirement, not a UI detail to fill in later. Rationale: silent queueing risks delivering a delayed emergency alert minutes after the incident, which is worse than a clear failure. For a barangay-scale pilot, a straightforward error is safer and simpler to explain to your panel.
- [ ] Figma wireframes for: resident app (alert screen, status view, and the offline error state) and dashboard (map view with status-differentiated pins — e.g. outlined/pulsing for unverified, solid for verified, grayed for resolved — incident list, detail panel)
- [ ] For each module in Section 4: run Kiro's spec `design.md` generation, referencing the shared schema and wireframes. Review each design doc against your steering file before approving — this is the checkpoint that keeps 9 separate specs architecturally consistent, especially the role gate on Module 8.

---

## 6. Phase 4 — Development (Weeks 7–14, the bulk of the timeline)

Maps to your thesis's "Development" sub-phase.

Recommended build order (each an approved Kiro spec, `tasks.md` generated and executed):

1. **Authentication & Role-Based Accounts** — foundation everything else depends on; get `role` right first, since Modules 5 and 8 both branch on it
2. **Firestore schema + security rules implementation** — from Phase 3 design, including the officials-only verify rule
3. **GPS Location Capture & Sharing** — core differentiator, test early
4. **Emergency Alert (one-tap report)** — depends on 1–3; includes the Option B offline error handling
5. **Incident Data Model & Status Lifecycle** — the `unverified → verified → resolved` state machine, real-time listeners
6. **Notification Fan-Out (Expo Push API)** — on login, store the device's Expo push token in `users/{uid}.expoPushToken`; when an alert is submitted, query Firestore for all official/tanod tokens and send a batch push via the Expo Push API; test that it reaches multiple physical devices at once, none of them "primary"
7. **Dashboard Live Map** — Google Maps JS API, real-time Firestore listener, status-differentiated pins
8. **Barangay Official & Tanod Dashboard — List & Detail Panel** — consumes the sync layer from Module 7, renders incident list and detail panel
9. **Incident Verification & Resolution** — the role-gated write, plus the acknowledgment-race handling from Phase 3
10. **Admin/Records module** — lowest risk, build last if time is tight

Working rhythm per module: approve `requirements.md` → approve `design.md` → let Kiro generate `tasks.md` → execute tasks in small batches, reviewing diffs rather than accepting everything blind → manual smoke test on a real device (GPS behaves differently in simulators) before moving to the next module.

- [ ] Set up Kiro **agent hooks** for repetitive checks (e.g., run linter/tests on save, flag any Firestore write that touches `status` without a role check) — worth 30 minutes of setup, especially valuable here since the role gate is your single most security-sensitive line of logic
- [ ] Keep a running decision log (even a plain markdown file `DECISIONS.md` at the repo root) of any place you override Kiro's suggestion — useful both for debugging later and as evidence of your own technical judgment for the defense. Commit this file from day one so it has a full history.
- [ ] **Draft the ISO/IEC 25010 evaluation questionnaire at Week 10–11** — while the core modules (Auth, GPS, Alert, Notifications) are working but you are not yet in crunch. Structure it around the five quality characteristics relevant to your system: Functionality, Usability, Reliability, Efficiency, and Security. Get your thesis adviser to review and approve it during this window. By the time the pilot starts in Week 17, it should already be printed and ready. Drafting it during testing (as originally placed) is too late — you risk rushing it or having adviser feedback arrive after the pilot begins.

---

## 7. Phase 5 — Testing (Weeks 14–17)

Maps to your thesis's "Testing" sub-phase: functionality, location accuracy, notification delivery, security.

> **Feature Freeze: End of Week 15.** Anything not built by the end of Week 15 gets cut or deferred — not rushed. Weeks 16–17 are bug-fix-only for what already exists. This gives you a realistic one-week buffer for defects found during testing without blowing the Week 17 deployment window. Set this as a hard milestone on your task board in Phase 0 so it's visible from the start, not decided under pressure.

- [ ] Functional testing per module against the acceptance criteria written in Phase 2
- [ ] GPS accuracy testing in the field within Barangay Marketview boundaries (not just indoors/simulator)
- [ ] Notification delivery testing across network conditions (weak signal is realistic for your context) — confirm multiple devices receive the same broadcast at roughly the same time, with none acting as a bottleneck
- [ ] **Role-gate testing, specifically**: attempt a `status: verified` write as a tanod account and as an unauthenticated request, and confirm both are rejected by the security rules (not just hidden by the UI)
- [ ] **Race-condition testing**: trigger near-simultaneous verify attempts from two official accounts on the same incident, confirm only one succeeds and the second gets a clear rejection
- [ ] Prepare the ISO/IEC 25010 evaluation questionnaire (functionality, usability, reliability, efficiency, security) for your ~30 residents + 5 officials — **this should already be drafted and adviser-approved from Week 10–11 in Phase 4**; use Phase 5 only to finalize printing and distribution logistics
- [ ] Pilot the survey, then compute weighted means per your Chapter 3 formula

---

## 8. Phase 6 — Deployment (Weeks 17–18)

Maps to your thesis's "Deployment" sub-phase: pilot release within Barangay Marketview.

- [ ] Deploy dashboard to Firebase Hosting
- [ ] Build and distribute the mobile app for pilot testing (Expo EAS Build — internal distribution is enough for a barangay pilot, no need for app store review)
- [ ] Brief orientation session for barangay officials and tanods — specifically clarify who can verify vs. who can only view, since that's a workflow change from "everyone treats every report as real" to a two-stage trust model
- [ ] Monitor the pilot window and log any incidents/bugs for your Results and Discussion chapter

---

## 9. Working With Kiro — Practical Notes

- **Don't skip the requirements/design review step.** Kiro will happily generate `tasks.md` from a thin requirements doc, but the tasks will be generic. The 20 minutes you spend tightening `requirements.md` against your actual interview data — and against decisions like the role gate — saves rework later, and gives you a paper trail that maps cleanly to Chapter 1's Statement of the Problem for your defense.
- **Steering files are cheap insurance.** Since this is a two-app system (mobile + dashboard) built by one developer, a steering file that states the no-main-device and officials-only-verify rules once prevents drift between modules built weeks apart.
- **Treat generated tasks as a checklist to review, not a black box to trust.** Especially for the security-rules and role-gate modules — that's where a subtly wrong Kiro suggestion is easiest to miss and most costly. A rule that looks right but checks `role` client-side instead of in `firestore.rules` will pass a casual demo and fail a security evaluation.

---

## 10. Suggested High-Level Timeline (one academic term, adjust to your actual calendar)

| Weeks | Phase | Key Milestones |
|-------|-------|----------------|
| 1 | Setup (Phase 0) | Repos created, Firebase initialized (free Spark plan), Expo Push spike confirmed on physical device, steering files written, task board set up with Feature Freeze milestone |
| 2–3 | Planning (Phase 1) | GPS → Firestore → Expo Push spike confirmed end-to-end on two physical devices; MVP scope locked |
| 3–5 | Analysis (Phase 2) | All 9 module `requirements.md` drafted with user stories; interview data collected |
| 5–7 | Design (Phase 3) | Firestore schema + security rules decided; offline behavior (Option B) encoded in Module 2 design; Figma wireframes including offline error state; all `design.md` approved |
| 7–14 | Development (Phase 4) | 10 modules built in order; ISO/IEC 25010 questionnaire drafted + adviser-approved by Week 11 |
| **End of Week 15** | **⚑ Feature Freeze** | **No new features after this point — bug fixes only** |
| 14–17 | Testing (Phase 5) | Functional, GPS, notification, role-gate, and race-condition tests; Weeks 16–17 are defect buffer |
| 17–18 | Deployment (Phase 6) | Firebase Hosting deploy, EAS Build distribution, pilot orientation, monitoring |

Development is intentionally the longest phase — 10 modules (including the new Dashboard Live Map spec) is a realistic but tight scope for a solo capstone. The Phase 0 spike test is non-negotiable: if GPS → Firestore → Expo Push → two physical devices doesn't work cleanly in Week 1, the timeline needs to shrink the module list, not just work faster. The Feature Freeze at end of Week 15 is your safety valve — protect it.

---

## 11. Step-by-Step Guidance — Before, During, and After the Plan

This section is your running companion guide. It tells you exactly what to do at each stage, what to ask Kiro for, and what to verify before moving on. Follow it sequentially.

---

### Stage 1 — Before You Open Kiro (Phase 0, Week 1)

These are manual steps. Do not start a Kiro spec until every item here is done.

**Step 1: Create your repos**
- Create two GitHub repos: `emergo-mobile` and `emergo-dashboard`
- Initialize each with a `README.md` and a `.gitignore` (Expo/Node for mobile, React for dashboard)
- Clone both locally

**Step 2: Set up Firebase**
- Go to [console.firebase.google.com](https://console.firebase.google.com), create a project named `emergo`
- Enable: Authentication, Cloud Firestore (production mode), Hosting
- Under Authentication → Sign-in method, enable **Phone Number** as the provider
- Under Authentication → Sign-in method → Phone → **Test phone numbers**: add a few fake numbers (e.g. `+63 900 000 0001`) with fixed OTP codes (e.g. `123456`) — use these during all development and testing to avoid hitting the 10 SMS/day free-tier limit. Switch to real numbers only for the actual pilot.
- The **free Spark plan is sufficient** — no billing upgrade needed. Cloud Functions is not part of this project.
- Do NOT enable Cloud Functions or Cloud Messaging — notifications are handled by Expo Push API instead

**Step 3: Expo Push Notifications spike (your first real test)**
- Install `expo-notifications` in the mobile project:
  ```bash
  npx expo install expo-notifications expo-device expo-constants
  ```
- Add this to your `app.json` under `expo`:
  ```json
  "plugins": [
    ["expo-notifications", { "icon": "./assets/notification-icon.png" }]
  ]
  ```
- Write a quick test screen that requests notification permissions and logs the Expo push token:
  ```typescript
  import * as Notifications from 'expo-notifications';
  import * as Device from 'expo-device';

  async function registerForPushNotifications() {
    if (!Device.isDevice) {
      alert('Must use a physical device for push notifications');
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token); // copy this
  }
  ```
- Run on a **physical device** (not a simulator — tokens don't work on simulators)
- Copy the token from the console and test a push using the [Expo Push Tool](https://expo.dev/notifications)
- Confirm the notification arrives on the device
- **If this fails:** Common issues: running on simulator instead of device, missing `projectId` in `getExpoPushTokenAsync()` (add `{ experienceId: '@yourusername/emergo' }` as argument), or permissions denied. Resolve before moving on.

**Step 4: Google Maps Platform**
- Go to [console.cloud.google.com](https://console.cloud.google.com), enable:
  - Maps SDK for Android (for `emergo-mobile`)
  - Maps SDK for iOS (for `emergo-mobile`)
  - Maps JavaScript API (for `emergo-dashboard`)
  - Geocoding API
- Create two API keys: one restricted to your app's package name (mobile), one restricted to your dashboard's domain (web)
- Store them in `.env` files — never hardcode, never commit

**Step 5: Write your steering files**
- In `emergo-mobile`: create `.kiro/steering/project.md`
- In `emergo-dashboard`: create `.kiro/steering/project.md`
- Each file should cover: tech stack, folder structure, naming conventions, and the System-Wide Invariants block from Phase 0 (copy it verbatim into both)
- Add a cross-reference note at the top of each pointing to the other repo's steering file

**Step 6: Create DECISIONS.md**
- In both repos, create a `DECISIONS.md` at the root and commit it immediately
- First entry should be:
  ```
  ## 2026 — Offline Behavior (Module 2)
  Decision: Option B — Block with error. No offline queueing.
  Rationale: Silent delayed delivery of emergency alerts is a safety risk for a barangay-scale pilot.
  ```

**Step 7: Set up your task board**
- In Trello/Notion/GitHub Projects, create columns: Backlog → In Progress → Review → Done
- Add one card per module (1–9 from Phase 2) plus setup tasks
- Add a **Feature Freeze** milestone marker at the end of Week 15 — make it visible at the top of the board

---

### Stage 2 — During Planning and Analysis (Phases 1–2, Weeks 2–5)

**For each module, before creating a Kiro spec:**

1. **Write 2–4 user stories** in EARS format:
   - `WHEN [event] THE SYSTEM SHALL [response]`
   - Example for Module 2: *"WHEN a resident taps the alert button and the device has no internet connection, THE SYSTEM SHALL display an error message and not submit the report."*

2. **Map each story to your Chapter 1 objectives** — if a story doesn't trace back to a problem statement, cut it or flag it as nice-to-have

3. **Save the stories as a plain `.md` file** in a `/specs/moduleX/` folder — this becomes the seed you paste into Kiro when generating `requirements.md`

4. **For Module 8 (Verification) specifically:** write these acceptance criteria word for word before opening Kiro:
   - *"WHEN a user with role != 'official' attempts to write status: 'verified', THE SYSTEM SHALL reject the write at the Firestore security rules level."*
   - *"WHEN two officials attempt to verify the same incident simultaneously, THE SYSTEM SHALL use a Firestore transaction so only the first write succeeds and the second receives a clear rejection message."*

---

### Stage 3 — Working With Kiro Per Module (Phase 4, Weeks 7–15)

Follow this rhythm for every module:

1. **Open Kiro, start a Spec session** for the module
2. **Paste your user stories** as the starting context — Kiro will use these to generate `requirements.md`
3. **Review `requirements.md`** before approving: check that every requirement maps to a story, that the offline error behavior is present in Module 2, and that the role gate is present in Module 8
4. **Approve `requirements.md`**, then let Kiro generate `design.md`
5. **Review `design.md`** against your steering file — specifically check:
   - Does the design enforce role checks in `firestore.rules` or only in the UI? (must be rules)
   - Does Module 6 (Live Map) use Google Maps JS API, not the mobile SDK?
   - Does Module 2 show the Option B offline error, not a queue/retry pattern?
6. **Approve `design.md`**, then let Kiro generate `tasks.md`
7. **Execute tasks in small batches** — review each diff before accepting, don't approve entire files blind
8. **After each module: smoke test on a real device** — GPS and push notifications behave differently in simulators
9. **Log any override in `DECISIONS.md`** with the date and reason

---

### Stage 4 — Key Checkpoints to Verify Before Moving On

| After completing... | Verify this before starting the next module |
|---------------------|---------------------------------------------|
| Module 1 (Auth) | Log in with a test phone number — confirm OTP flow works and `users/{uid}` is created with `role: 'resident'`. Then manually set a test account to `role: 'tanod'` in Firestore and confirm it cannot write `status: 'verified'` — test in Firestore rules simulator |
| Module 2 (Alert) | Tap the alert button with airplane mode on — confirm the error prompt appears, no background submission |
| Module 3 (GPS) | Confirm coordinates land in Firestore as a `GeoPoint`, not a plain string |
| Module 5 (Notifications) | On login as an official/tanod, confirm an Expo push token is stored in `users/{uid}.expoPushToken` in Firestore. Submit a test alert and confirm the push notification arrives on two separate physical official/tanod devices at roughly the same time |
| Module 6 (Live Map) | Open the dashboard and create a new incident — confirm the map pin appears without a page refresh |
| Module 8 (Verification) | Log in as a tanod account and attempt a verify — confirm Firestore rejects it. Then trigger two simultaneous verifies from two official accounts on the same incident — confirm only one succeeds |

---

### Stage 5 — After the Pilot (Phase 6 and Beyond, Weeks 17–18+)

**During the pilot:**
- Keep a plain log (can be a shared Google Doc) of every bug or confusion reported — barangay officials may not use technical language, so record their words verbatim and translate to technical issues after
- Watch the Firebase console for any Functions errors or unusual Firestore write patterns

**After the pilot, for your thesis:**
- Your `DECISIONS.md` is direct evidence of your own technical judgment — reference it in Chapter 4 (Results) when explaining architectural choices
- The race-condition test result (Module 8 checkpoint above) is a concrete security finding worth highlighting in your evaluation
- If any module was cut at Feature Freeze, document it honestly in Chapter 5 (Conclusions) as a limitation with a recommendation for future work — panels respect honest scoping over overpromised features

**Handover to the barangay:**
- Write a one-page operations guide for officials: how to verify an incident, how to resolve one, and what to do if the app shows an offline error
- Document the Firebase project credentials handover process — the barangay captain or IT officer should own the Firebase project, not your personal Google account, before you submit your thesis
