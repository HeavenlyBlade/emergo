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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { UserRole } from '../types';

const TEST_ACCOUNTS: { label: string; role: UserRole; uid: string; name: string }[] = [
  { label: '🏛 Official', role: 'official', uid: 'dev_official_001', name: 'Dev Official' },
  { label: '👮 Tanod', role: 'tanod', uid: 'dev_tanod_001', name: 'Dev Tanod' },
  { label: '👤 Resident', role: 'resident', uid: 'dev_resident_001', name: 'Dev Resident' },
];

const SESSION_KEY = 'emergo_dashboard_uid';

export default function DevLoginPage({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);

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
      </div>
    </div>
  );
}
