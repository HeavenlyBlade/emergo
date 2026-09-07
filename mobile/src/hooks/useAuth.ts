/**
 * useAuth — manages session and user document state
 *
 * On mount: checks AsyncStorage for a stored uid.
 * If found: loads the Firestore user document and subscribes to real-time updates.
 * If not found: user is not logged in.
 *
 * Exposes a refresh function so screens can trigger a reload after login.
 */

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getStoredSession } from '../services/authService';
import { db } from '../services/firebase';
import { UserDocument } from '../types';

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

  // Call refresh() after login/logout to re-check session
  const refresh = useCallback(() => setTick((t) => t + 1), []);

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

      // Subscribe to real-time user document updates
      const userRef = doc(db, 'users', storedUid);
      unsubscribeDoc = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUserDoc({ uid: storedUid, ...snap.data() } as UserDocument);
        } else {
          setUserDoc(null);
        }
        setLoading(false);
      });
    };

    init();

    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [tick]);

  return { uid, userDoc, loading, refresh };
}
