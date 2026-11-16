import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useUsers() {
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const map: Record<string, string> = {};
        snap.forEach((d) => {
          const data = d.data();
          if (data.displayName) map[d.id] = data.displayName;
        });
        setUsersMap(map);
      })
      .catch((err) => console.error('[useUsers] getDocs error:', err))
      .finally(() => setUsersLoading(false));
  }, []);

  return { usersMap, usersLoading };
}
