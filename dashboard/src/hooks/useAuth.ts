/**
 * useAuth — dashboard session and user document state
 *
 * C4 fix: Session gate is now Firebase Auth's onAuthStateChanged — not a bare
 *   localStorage uid. auth.currentUser must be non-null (i.e. the user has
 *   completed signInAnonymously in authService) before we trust the session.
 *   The localStorage SESSION_KEY is used only as a lookup hint to find the
 *   Emergo users/{uid} Firestore document — it is never the auth gate itself.
 *
 * Other fixes retained:
 * - W7: calls signOut() when user doc is deleted while session is active
 * - W11: sets uid and userDoc in same batch before setting loading=false
 *        to prevent AuthGuard flash of login page on hard refresh
 */

import { useEffect, useState, useCallback } from 'react';
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

  // refresh() is only needed for sign-out to clear local state.
  // On login, onAuthStateChanged fires automatically — no manual kick needed.
  const refresh = useCallback(() => {
    if (!auth.currentUser) {
      setUid(null);
      setUserDoc(null);
    }
  }, []);

  useEffect(() => {
    let firestoreUnsub: (() => void) | undefined;

    // C4 fix: The primary auth gate is Firebase Auth's onAuthStateChanged.
    // Only when Firebase confirms an active session (firebaseUser != null)
    // do we trust the SESSION_KEY hint and subscribe to the Firestore user doc.
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up any prior Firestore listener before potentially re-attaching
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = undefined;
      }

      if (!firebaseUser) {
        // No Firebase Auth session — not authenticated
        setUid(null);
        setUserDoc(null);
        setLoading(false);
        return;
      }

      // Firebase Auth session exists; look up the Emergo user document
      const emergoUid = getStoredSession();
      if (!emergoUid) {
        // Firebase says authenticated but no Emergo uid hint — sign out to reset
        signOut().catch(() => {});
        setUid(null);
        setUserDoc(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', emergoUid);
      firestoreUnsub = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            // Set uid and userDoc atomically — prevents AuthGuard seeing uid=value + userDoc=null
            setUid(emergoUid);
            setUserDoc({ uid: emergoUid, ...snap.data() } as UserDocument);
          } else {
            // Doc deleted while session active — force sign out to prevent limbo
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
    });

    return () => {
      unsub();
      if (firestoreUnsub) firestoreUnsub();
    };
  // Empty deps — listener is set up once and stays alive for the app lifetime.
  // onAuthStateChanged handles all session changes (login, sign-out, expiry).
  }, []);

  return { uid, userDoc, loading, refresh };
}
