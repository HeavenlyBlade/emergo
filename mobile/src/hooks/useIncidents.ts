/**
 * useIncidents — real-time incident list for officials and tanods
 *
 * Subscribes to all incidents ordered by reportedAt descending.
 * Officials and tanods see all incidents.
 * Residents use subscribeToMyIncidents in incidentService directly.
 *
 * Accepts an optional refreshKey — incrementing it forces the listener
 * to re-subscribe, useful when the real-time stream has stalled.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { IncidentDocument } from '../types';

interface UseIncidentsReturn {
  incidents: IncidentDocument[];
  loading: boolean;
}

export function useIncidents(refreshKey?: number): UseIncidentsReturn {
  const [incidents, setIncidents] = useState<IncidentDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'incidents'),
      orderBy('reportedAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d: { id: string; data: () => Record<string, unknown> }) => ({
          id: d.id,
          ...d.data(),
        })) as IncidentDocument[];
        setIncidents(data);
        setLoading(false);
      },
      (err: Error) => {
        console.error('[useIncidents] onSnapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  // refreshKey is intentionally in deps — incrementing it forces a re-subscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return { incidents, loading };
}
