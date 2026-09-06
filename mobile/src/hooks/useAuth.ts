/**
 * useAuth — subscribes to Firebase auth state and the user's Firestore document.
 *
 * Returns:
 *   user        — Firebase Auth user (null if signed out)
 *   userDoc     — Firestore users/{uid} document (null if not loaded yet)
 *   loading     — true while the initial auth state is being determined
 */

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { subscribeToAuthState } from '../services/authService';
import { db } from '../services/firebase';
import { UserDocument } from '../types';

interface UseAuthReturn {
  user: User | null;
  userDoc: UserDocument | null;
  loading: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth state
    const unsubscribeAuth = subscribeToAuthState((firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserDoc(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to the user's Firestore document in real time
    // This way if an admin changes their role, the app reflects it immediately
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeDoc = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserDoc({ uid: user.uid, ...snap.data() } as UserDocument);
      }
      setLoading(false);
    });

    return () => unsubscribeDoc();
  }, [user]);

  return { user, userDoc, loading };
}
