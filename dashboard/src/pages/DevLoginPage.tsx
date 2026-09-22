/**
 * DevLoginPage — hidden developer bypass route
 *
 * Only accessible at /dev-login
 * Skips OTP entirely — sets a fake session directly in localStorage.
 * For development testing only. Remove before production.
 *
 * Creates a test user document in Firestore if it doesn't exist.
 */

import { useState } from 'react';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, GeoPoint } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { UserRole } from '../types';

const TEST_ACCOUNTS: { label: string; role: UserRole; uid: string; name: string }[] = [
  { label: '🏛 Official', role: 'official', uid: 'dev_official_001', name: 'Dev Official' },
  { label: '👮 Tanod', role: 'tanod', uid: 'dev_tanod_001', name: 'Dev Tanod' },
  { label: '👤 Resident', role: 'resident', uid: 'dev_resident_001', name: 'Dev Resident' },
];

// Seed incidents around Barangay Marketview, Lucena City
const SEED_INCIDENTS = [
  {
    status: 'unverified',
    reportedBy: 'dev_resident_001',
    location: new GeoPoint(13.9371, 121.6172),
    description: 'Fire reported near market stalls',
  },
  {
    status: 'verified',
    reportedBy: 'dev_resident_001',
    location: new GeoPoint(13.9380, 121.6180),
    description: 'Medical emergency — elderly collapsed',
    verifiedBy: 'dev_official_001',
  },
  {
    status: 'resolved',
    reportedBy: 'dev_resident_001',
    location: new GeoPoint(13.9365, 121.6168),
    description: 'Flooding on main street',
    verifiedBy: 'dev_official_001',
  },
  {
    status: 'unverified',
    reportedBy: 'dev_resident_001',
    location: new GeoPoint(13.9376, 121.6185),
    description: 'Suspicious persons near barangay hall',
  },
  {
    status: 'verified',
    reportedBy: 'dev_resident_001',
    location: new GeoPoint(13.9368, 121.6175),
    description: 'Accident — motorcycle collision',
    verifiedBy: 'dev_official_001',
  },
];

const SESSION_KEY = 'emergo_dashboard_uid';

export default function DevLoginPage({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const handleSeed = async () => {
    setLoading('seed');
    try {
      // Ensure resident user exists first
      const residentRef = doc(db, 'users', 'dev_resident_001');
      const residentSnap = await getDoc(residentRef);
      if (!residentSnap.exists()) {
        await setDoc(residentRef, {
          role: 'resident',
          displayName: 'Dev Resident',
          phoneNumber: '+630000000002',
          createdAt: serverTimestamp(),
        });
      }

      for (const incident of SEED_INCIDENTS) {
        await addDoc(collection(db, 'incidents'), {
          ...incident,
          reportedAt: serverTimestamp(),
          verifiedAt: incident.verifiedBy ? serverTimestamp() : null,
          resolvedAt: incident.status === 'resolved' ? serverTimestamp() : null,
        });
      }
      setSeeded(true);
    } catch (e: any) {
      alert('Seed error: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleLogin = async (account: typeof TEST_ACCOUNTS[0]) => {
    setLoading(account.uid);
    try {
      // Create user doc if it doesn't exist
      const userRef = doc(db, 'users', account.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          role: account.role,
          displayName: account.name,
          phoneNumber: '+630000000000',
          createdAt: serverTimestamp(),
        });
      }

      // Set session
      localStorage.setItem(SESSION_KEY, account.uid);
      onLogin();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm border border-gray-700">
        <div className="text-center mb-6">
          <span className="text-4xl">🛠</span>
          <h1 className="text-xl font-bold text-white mt-2">Dev Login</h1>
          <p className="text-gray-400 text-sm mt-1">
            Hidden bypass — development only
          </p>
          <div className="mt-2 bg-yellow-900/50 border border-yellow-700 rounded-lg px-3 py-2">
            <p className="text-yellow-400 text-xs">
              ⚠️ This route is for testing only. Remove before deployment.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {TEST_ACCOUNTS.map((account) => (
            <button
              key={account.uid}
              onClick={() => handleLogin(account)}
              disabled={loading === account.uid}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium h-12 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-3 text-sm"
            >
              {loading === account.uid ? (
                <span className="animate-pulse">Logging in...</span>
              ) : (
                <>
                  <span>{account.label}</span>
                  <span className="text-gray-400 text-xs">({account.role})</span>
                </>
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          /dev-login — not linked from anywhere
        </p>

        {/* Seed incidents */}
        <div className="mt-4 border-t border-gray-700 pt-4">
          <button
            onClick={handleSeed}
            disabled={loading === 'seed' || seeded}
            className="w-full bg-blue-900 hover:bg-blue-800 text-blue-200 font-medium h-10 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {loading === 'seed'
              ? 'Seeding...'
              : seeded
              ? '✅ Incidents seeded'
              : '🌱 Seed test incidents (5)'}
          </button>
          <p className="text-gray-600 text-xs text-center mt-1">
            Adds 5 test incidents around Barangay Marketview
          </p>
        </div>
      </div>
    </div>
  );
}
