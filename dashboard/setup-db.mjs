/**
 * setup-db.mjs — Emergo database setup script (Admin SDK)
 *
 * Uses Firebase Admin SDK — bypasses all Firestore security rules.
 * Requires service-account.json in the repo root.
 *
 * Run from the dashboard/ directory:
 *   node setup-db.mjs
 *
 * What it does:
 *   1. Drops ALL documents in: users, incidents, otp_codes, tanod_locations
 *   2. Creates fresh official accounts defined in ACCOUNTS below
 *   3. Optionally seeds test incidents (set SEED_INCIDENTS = true)
 *
 * To add more accounts, edit the ACCOUNTS array.
 */

import { webcrypto } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { default: admin } = await import('firebase-admin');

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'service-account.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ─── Accounts to create ───────────────────────────────────────────────────────
const ACCOUNTS = [
  {
    username:    'brgy_mon',
    password:    'moneta456',
    displayName: 'Mon Gabriel Eta',
    phoneNumber: '+639000000001',
    role:        'official',
  },
  // Add more here:
  // { username: 'brgy_captain', password: 'secret123', displayName: 'Juan dela Cruz', phoneNumber: '+639000000002', role: 'official' },
];

// ─── Collections to wipe ─────────────────────────────────────────────────────
const COLLECTIONS_TO_DROP = ['users', 'incidents', 'otp_codes', 'tanod_locations'];

// ─── Seed test incidents? ─────────────────────────────────────────────────────
const SEED_INCIDENTS = false;

// ─── PBKDF2 helpers ───────────────────────────────────────────────────────────
function hexFromBuffer(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt    = new Uint8Array(16);
  webcrypto.getRandomValues(salt);
  const saltHex = hexFromBuffer(salt.buffer);

  const keyMaterial = await webcrypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial, 256
  );
  return { hash: hexFromBuffer(derivedBits), salt: saltHex };
}

// ─── Drop entire collection ───────────────────────────────────────────────────
async function dropCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) {
    console.log(`  ${name}: already empty — skipped`);
    return;
  }
  // Delete in batches of 400
  const batches = [];
  let batch = db.batch();
  let count = 0;
  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    count++;
    if (count === 400) {
      batches.push(batch.commit());
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) batches.push(batch.commit());
  await Promise.all(batches);
  console.log(`  ${name}: deleted ${snap.size} document(s)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('=== Emergo DB Setup (Admin SDK) ===\n');

// Step 1 — Drop collections
console.log('Step 1: Dropping collections...');
for (const col of COLLECTIONS_TO_DROP) {
  await dropCollection(col);
}

// Step 2 — Create accounts
console.log('\nStep 2: Creating official accounts...');
for (const account of ACCOUNTS) {
  const uid = `user_${account.username}`;
  const { hash: passwordHash, salt: passwordSalt } = await hashPassword(account.password);

  await db.collection('users').doc(uid).set({
    role:         account.role,
    displayName:  account.displayName,
    phoneNumber:  account.phoneNumber,
    username:     account.username.toLowerCase(),
    passwordHash,
    passwordSalt,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`  Created: ${account.username} (${account.role})  uid: ${uid}`);
}

// Step 3 — Seed incidents (optional)
if (SEED_INCIDENTS) {
  console.log('\nStep 3: Seeding test incidents...');
  const residentUid = 'resident_seed_001';

  await db.collection('users').doc(residentUid).set({
    role: 'resident', displayName: 'Test Resident',
    phoneNumber: '+639000000099',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const seed = [
    { status: 'unverified', description: 'Fire near market stalls',      severity: 'extreme',  lat: 13.9371, lng: 121.6172 },
    { status: 'verified',   description: 'Medical emergency — collapsed', severity: 'moderate', lat: 13.9380, lng: 121.6180 },
    { status: 'resolved',   description: 'Flooding on main street',       severity: 'light',    lat: 13.9365, lng: 121.6168 },
  ];

  for (const inc of seed) {
    await db.collection('incidents').add({
      status:     inc.status,
      description: inc.description,
      severity:   inc.severity,
      reportedBy: residentUid,
      location:   new admin.firestore.GeoPoint(inc.lat, inc.lng),
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: inc.status !== 'unverified' ? admin.firestore.FieldValue.serverTimestamp() : null,
      resolvedAt: inc.status === 'resolved'   ? admin.firestore.FieldValue.serverTimestamp() : null,
    });
    console.log(`  Seeded: ${inc.description}`);
  }
} else {
  console.log('\nStep 3: Skipping seed (SEED_INCIDENTS = false)');
}

console.log('\n=== Done ===');
console.log('Accounts ready:');
ACCOUNTS.forEach(a => console.log(`  username: ${a.username}   password: ${a.password}`));
console.log('\nLog in at: https://emergo-31db1.web.app');

process.exit(0);
