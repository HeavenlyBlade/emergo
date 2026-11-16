/**
 * useIncidents — real-time incident list for the dashboard
 */

import { useEffect, useState, useRef } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { IncidentDocument } from '../types';

export function useIncidents() {
  const [incidents, setIncidents] = useState<IncidentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIncidents, setNewIncidents] = useState<IncidentDocument[]>([]);
  const mountedRef = useRef(false);

  useEffect(() => {
    const q = query(
      collection(db, 'incidents'),
      orderBy('reportedAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as IncidentDocument[];

        if (!mountedRef.current) {
          // First snapshot: seed state, do not emit new incidents
          mountedRef.current = true;
          setIncidents(data);
          setLoading(false);
          return;
        }

        // Subsequent snapshots: collect truly added unverified docs
        const added: IncidentDocument[] = [];
        snap.docChanges().forEach((change) => {
          if (
            change.type === 'added' &&
            change.doc.data().status === 'unverified'
          ) {
            added.push({ id: change.doc.id, ...change.doc.data() } as IncidentDocument);
          }
        });

        setIncidents(data);
        setLoading(false);
        if (added.length > 0) {
          setNewIncidents(added);
        }
      },
      (err) => {
        console.error('[useIncidents] onSnapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { incidents, loading, newIncidents };
}
