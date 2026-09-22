/**
 * useAuth — dashboard session and user document state
 */

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getStoredSession, getUserDocument } from '../services/authService';
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

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    const init = async () => {
      setLoading(true);
      const storedUid = getStoredSession();
      setUid(storedUid);

      if (!storedUid) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', storedUid);
      unsub = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUserDoc({ uid: storedUid, ...snap.data() } as UserDocument);
        } else {
          setUserDoc(null);
        }
        setLoading(false);
      });
    };

    init();
    return () => { if (unsub) unsub(); };
  }, [tick]);

  return { uid, userDoc, loading, refresh };
}
