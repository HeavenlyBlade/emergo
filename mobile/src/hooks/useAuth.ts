/**
 * useAuth — manages session and user document state
 *
 * On mount: checks AsyncStorage for a stored uid.
 * If found: loads the Firestore user document and subscribes to real-time updates.
 * Push token is registered once after initial load, not on every snapshot.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getStoredSession, registerPushTokenIfNeeded } from '../services/authService';
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
  const tokenRegistered = useRef(false);

  const refresh = useCallback(() => {
    tokenRegistered.current = false; // allow re-registration after login
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const init = async () => {
      setLoading(true);
      const storedUid = await getStoredSession();
      setUid(storedUid);

      if (!storedUid) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', storedUid);
      unsubscribeDoc = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = { uid: storedUid, ...snap.data() } as UserDocument;
            setUserDoc(data);

            // Register push token once per session, not on every snapshot update
            if (!tokenRegistered.current) {
              tokenRegistered.current = true;
              registerPushTokenIfNeeded(storedUid, data.role).catch((err) => {
                console.warn('[useAuth] Push token registration failed:', err);
              });
            }
          } else {
            // User doc was deleted — clear session
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

    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [tick]);

  return { uid, userDoc, loading, refresh };
}
