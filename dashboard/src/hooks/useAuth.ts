/**
 * useAuth — dashboard session and user document state
 *
 * Fixes applied:
 * - W7: calls signOut() when user doc is deleted while session is active
 * - W11: sets uid and userDoc in same batch before setting loading=false
 *        to prevent AuthGuard flash of login page on hard refresh
 */

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getStoredSession, signOut } from '../services/authService';
import { db } from '../services/firebase';
import type { UserDocument } from '../types';

interface UseAuthReturn {
  uid: string | null;
  userDoc: UserDocument | null;
  loading: boolean;
  refresh: () => void;
}

export function useAuth(): UseAuthReturn {
  const [uid, setUid] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    const init = async () => {
      setLoading(true);
      const storedUid = getStoredSession();

      if (!storedUid) {
        // Batch all state updates together to avoid intermediate renders
        setUid(null);
        setUserDoc(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', storedUid);
      unsub = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            // Set uid and userDoc atomically — prevents AuthGuard seeing uid=value + userDoc=null
            setUid(storedUid);
            setUserDoc({ uid: storedUid, ...snap.data() } as UserDocument);
          } else {
            // Doc deleted while session active — force sign out to prevent limbo
            signOut();
            setUid(null);
            setUserDoc(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('[useAuth] onSnapshot error:', err);
          setLoading(false);
        }
      );
    };

    init().catch((err) => {
      console.error('[useAuth] init failed:', err);
      setLoading(false);
    });

    return () => { if (unsub) unsub(); };
  }, [tick]);

  return { uid, userDoc, loading, refresh };
}
