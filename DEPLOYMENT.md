# Emergo — Deployment Guide

Follow every step in order. Do not skip ahead.

---

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- Firebase CLI: `npm install -g firebase-tools`
- EAS CLI: `npm install -g eas-cli`
- Active internet connection
- Firebase project: **emergo-31db1** (already created)
- EAS project ID: `1867c7c7-900c-4ba8-969b-20207dfc13ff` (already in `app.json`)

---

## Step 1 — Deploy Firestore Security Rules

This must be done first, before the pilot. The rules enforce role-based access control at the database level.

```
cd "C:\Users\Asus\Desktop\Emergo\dashboard"
firebase login
firebase deploy --only firestore:rules
```

Verify in the Firebase Console:
- Go to `console.firebase.google.com` → emergo-31db1 → Firestore → Rules
- Confirm the rules show the current timestamp (just deployed)
- Run a quick test in the **Rules Playground**:
  - Simulate a resident writing `status: verified` to an incident — it must be **denied**
  - Simulate an official writing `status: verified` — it must be **allowed**

---

## Step 2 — Deploy the Dashboard

### Build

```
cd "C:\Users\Asus\Desktop\Emergo\dashboard"
npm install
npm run build
```

Confirm the `dist/` folder was created and contains `index.html`.

### Deploy to Firebase Hosting

```
firebase deploy --only hosting
```

The dashboard will be live at:
```
https://emergo-31db1.web.app
```

Test it in an incognito browser window — you should see the Emergo login screen with no console errors.

### Environment variables

Dashboard credentials are in `dashboard/.env`. These are baked into the build at compile time via the `VITE_` prefix. They are safe to include (they are the Firebase client SDK config — Firebase project IDs are not secrets).

**Do not add the SMS Gateway credentials to the dashboard .env.** SMS sending is handled by the mobile app only.

---

## Step 3 — Build the Mobile APK

The APK is built remotely on Expo's servers (EAS Build). Your machine only needs to upload the source.

### Run the build

```
cd "C:\Users\Asus\Desktop\Emergo\mobile"
npx eas-cli build --profile preview --platform android --non-interactive
```

This produces an internal-distribution APK (no Play Store review needed — suitable for the barangay pilot).

**Build time:** approximately 10–20 minutes on EAS servers.

**If the build fails:** check the log URL printed in the terminal output, specifically the "Bundle JavaScript" phase. Common causes:
- `package-lock.json` out of sync → run `npm install --legacy-peer-deps` locally first, then retry
- Missing `google-services.json` → verify it is present in `mobile/` and listed in `.easignore` as `!google-services.json`

### Download and distribute the APK

1. Go to `https://expo.dev/accounts/hayven/projects/emergo/builds`
2. Find the completed build — click **Download**
3. Transfer the APK to each barangay Android device via USB, Google Drive, or a direct download link from the Expo dashboard
4. On each device: Settings → Security → Allow installation from unknown sources → Install the APK

---

## Step 4 — Create Official and Tanod Accounts

Before the pilot, create accounts for all barangay officials and tanods.

1. Open `https://emergo-31db1.web.app/dev-login`
2. For each official or tanod:
   - Select role: **Official** or **Tanod**
   - Fill in username, password, full name, phone number
   - Click **Create account**
3. Give each person their username and password verbally or in a sealed envelope — do not send via SMS

Residents do not need accounts created. They register themselves via OTP on first app launch.

---

## Step 5 — Configure the sms-server-device

The sms-server-device is the dedicated Android phone that physically sends OTP SMS messages.

1. Install the Android SMS Gateway APK from:
   `https://github.com/capcom6/android-sms-gateway/releases`
2. Open the app, enable **Cloud Server** mode, tap **Online**
3. Confirm the credentials match `mobile/.env`:
   ```
   EXPO_PUBLIC_SMS_GATEWAY_USER=QETICF
   EXPO_PUBLIC_SMS_GATEWAY_PASS=eiqmu3io7wnphn
   ```
   If the app shows different credentials, update `mobile/.env` and rebuild the APK.
4. Disable battery optimization for the app:
   Settings → Apps → Android SMS Gateway → Battery → Unrestricted
5. Keep the phone plugged in or ensure it does not go into deep sleep during the pilot

---

## Step 6 — Pre-Pilot Verification

Run through these before the pilot session begins:

- [ ] Firestore rules deployed and verified in Firebase Console
- [ ] Dashboard live at `https://emergo-31db1.web.app` — login works for an official account
- [ ] APK installed on all pilot devices
- [ ] sms-server-device is Online with SMS credit
- [ ] SMS gateway test passes (see TESTING_GUIDE.md — Quick SMS Gateway Check)
- [ ] One resident test registration completes end-to-end (OTP received, name entered, alert screen shown)
- [ ] One test alert sent — appears on dashboard map within 5 seconds

---

## Post-Pilot

### Handover to barangay

Before submitting the thesis, transfer Firebase project ownership to the barangay:

1. Go to `console.firebase.google.com` → emergo-31db1 → Project Settings → Members
2. Add the barangay's Google account with **Owner** role
3. Remove your personal account after confirming they have access

### Credential rotation (required before production)

The SMS Gateway credentials in `mobile/.env` are embedded in the APK bundle at build time. Before public deployment:

1. In the Android SMS Gateway app, regenerate credentials (or create a new account)
2. Update `mobile/.env` with the new credentials
3. Rebuild the APK: `npx eas-cli build --profile production --platform android`
4. Redistribute the new APK to all devices

### Production APK (Play Store)

If the project is eventually submitted to the Play Store, use the production profile:

```
npx eas-cli build --profile production --platform android --non-interactive
```

This produces an `.aab` (Android App Bundle) suitable for Play Store submission.

---

## Quick Reference

| Task | Command |
|------|---------|
| Deploy Firestore rules | `firebase deploy --only firestore:rules` (from `dashboard/`) |
| Deploy dashboard | `npm run build` then `firebase deploy --only hosting` (from `dashboard/`) |
| Build preview APK | `npx eas-cli build --profile preview --platform android --non-interactive` (from `mobile/`) |
| Run dashboard tests | `node_modules\.bin\vitest run` (from `dashboard/`) |
| Run mobile tests | `node_modules\.bin\jest --forceExit` (from `mobile/`) |
| Start dashboard dev server | `npm run dev` (from `dashboard/`) |
| Start Expo dev server | `npm start -- --clear` (from `mobile/`) |
