/**
 * useIncidents — real-time incident list for the dashboard
 */

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const q = query(
      collection(db, 'incidents'),
      orderBy('reportedAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as IncidentDocument[];
      setIncidents(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { incidents, loading };
}
