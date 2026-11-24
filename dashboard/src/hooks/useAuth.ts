/**
 * useAuth — dashboard session and user document state
 *
 * C4 fix: Session gate is now Firebase Auth's onAuthStateChanged — not a bare
 *   localStorage uid. auth.currentUser must be non-null (i.e. the user has
 *   completed signInAnonymously in authService) before we trust the session.
 *   The localStorage SESSION_KEY is used only as a lookup hint to find the
 *   Emergo users/{uid} Firestore document — it is never the auth gate itself.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getStoredSession, signOut } from '../services/authService';
import { db, auth } from '../services/firebase';
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
  // Bumped by refresh() after login stores the session key, causing the
  // effect to re-run and pick up the now-available emergoUid.
  const [tick, setTick] = useState(0);
  const firestoreUnsubRef = useRef<(() => void) | undefined>(undefined);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    // Clean up any prior Firestore listener
    if (firestoreUnsubRef.current) {
      firestoreUnsubRef.current();
      firestoreUnsubRef.current = undefined;
    }

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      setUid(null);
      setUserDoc(null);
      setLoading(false);
      return;
    }

    const emergoUid = getStoredSession();
    if (!emergoUid) {
      // Firebase Auth session exists but no session key yet (mid-login).
      // Don't sign out — login flow will call refresh() once the key is stored.
      setUid(null);
      setUserDoc(null);
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', emergoUid);
    firestoreUnsubRef.current = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setUid(emergoUid);
          setUserDoc({ uid: emergoUid, ...snap.data() } as UserDocument);
        } else {
          signOut().catch(() => {});
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

    return () => {
      if (firestoreUnsubRef.current) {
        firestoreUnsubRef.current();
        firestoreUnsubRef.current = undefined;
      }
    };
  // Re-run when tick changes (after login) or on mount.
  // onAuthStateChanged is not needed here — login always calls refresh().
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Also respond to Firebase Auth state changes (initial session restore on reload,
  // token expiry, explicit sign-out)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        if (firestoreUnsubRef.current) {
          firestoreUnsubRef.current();
          firestoreUnsubRef.current = undefined;
        }
        setUid(null);
        setUserDoc(null);
        setLoading(false);
      } else {
        // Trigger re-evaluation when Firebase restores persisted session on page reload
        setTick((t) => t + 1);
      }
    });
    return unsub;
  }, []);

  return { uid, userDoc, loading, refresh };
}
