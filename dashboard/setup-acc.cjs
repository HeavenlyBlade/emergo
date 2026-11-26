/**
 * setup-acc.cjs — Create / recreate dashboard accounts
 *
 * Wipes the users collection and recreates all accounts listed in ACCOUNTS.
 * Does NOT touch incidents, otp_codes, or tanod_locations.
 *
 * Roles:
 *   'admin'    — full CRUD on the dashboard (manage accounts, incidents)
 *   'official' — verify and resolve incidents, view map and records
 *
 * Run from the dashboard/ directory:
 *   node setup-acc.cjs
 */

'use strict';

const { webcrypto } = require('crypto');
const admin = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { readFileSync } = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'service-account.json'), 'utf8')
);

const { initializeApp, cert } = admin;
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Accounts ────────────────────────────────────────────────────────────────
// Edit this list to add, remove, or change accounts.
// uid will be user_{username}.
const ACCOUNTS = [
  {
    username:    'brgy_admin',
    password:    'admin2025',
    displayName: 'Barangay Administrator',
    phoneNumber: '+639000000000',
    role:        'admin',
  },
  {
    username:    'brgy_mon',
    password:    'moneta456',
    displayName: 'Mon Gabriel Eta',
    phoneNumber: '+639000000001',
    role:        'official',
  },
  {
    username:    'brgy_responder',
    password:    'responder2026',
    displayName: 'Field Responder 1',
    phoneNumber: '+639000000002',
    role:        'responder',
  },
  // Add more officials here:
  // { username: 'brgy_captain', password: 'secret123', displayName: 'Juan dela Cruz', phoneNumber: '+639000000002', role: 'official' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hexFromBuffer(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = new Uint8Array(16);
  webcrypto.getRandomValues(salt);
  const saltHex = hexFromBuffer(salt.buffer);
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial, 256
  );
  return { hash: hexFromBuffer(bits), salt: saltHex };
}

async function dropCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) { console.log(`  ${name}: already empty`); return; }
  let batch = db.batch();
  let count = 0;
  const commits = [];
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++count === 400) { commits.push(batch.commit()); batch = db.batch(); count = 0; }
  }
  if (count > 0) commits.push(batch.commit());
  await Promise.all(commits);
  console.log(`  ${name}: deleted ${snap.size} document(s)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Emergo Account Setup ===\n');

  console.log('Wiping users collection...');
  await dropCollection('users');

  console.log('\nCreating accounts...');
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
      createdAt:    FieldValue.serverTimestamp(),
    });
    console.log(`  Created: ${account.username} (${account.role})  uid: ${uid}`);
  }

  console.log('\n=== Done ===');
  ACCOUNTS.forEach(a => console.log(`  username: ${a.username}   password: ${a.password}   role: ${a.role}`));
  console.log('\nLog in at: https://emergo-31db1.web.app');
  process.exit(0);
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
