/**
 * useIncidents — real-time incident list for officials and tanods
 *
 * Subscribes to all incidents ordered by reportedAt descending.
 * Officials and tanods see all incidents.
 * Residents use subscribeToMyIncidents in incidentService directly.
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

export function useIncidents(): UseIncidentsReturn {
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
