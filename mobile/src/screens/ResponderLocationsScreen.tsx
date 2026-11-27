/**
 * ResponderLocationsScreen — Resident view of live responder locations
 *
 * Replaces the inline "how much farther / how many responders" chip on AlertScreen
 * with a dedicated screen where residents can inspect active responders'
 * real-time coordinates, status, and open their location in Google Maps.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { subscribeToMyIncidents } from '../services/incidentService';
import { formatRelativeTime } from '../utils/incidentUtils';
import type { AppStackParamList, IncidentDocument, ResponderLocation } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'ResponderLocations'>;
};

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export default function ResponderLocationsScreen({ navigation }: Props) {
  const { uid } = useAuth();
  const [responders, setResponders] = useState<ResponderLocation[]>([]);
  const [incidents, setIncidents] = useState<IncidentDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mergeLocations = (
      prev: ResponderLocation[],
      incoming: ResponderLocation[]
    ): ResponderLocation[] => {
      const merged = new Map<string, ResponderLocation>();
      prev.forEach((p) => merged.set(p.uid, p));
      incoming.forEach((l) => merged.set(l.uid, l));
      return Array.from(merged.values());
    };

    const filterActive = (docs: { id: string; data: () => any }[]): ResponderLocation[] => {
      const now = Date.now();
      return docs
        .map((d) => ({ uid: d.id, ...d.data() }) as ResponderLocation)
        .filter(
          (loc) =>
            typeof loc.latitude === 'number' &&
            typeof loc.longitude === 'number' &&
            loc.isVisible !== false &&
            (!loc.lastSeen ||
              typeof loc.lastSeen.toDate !== 'function' ||
              now - loc.lastSeen.toDate().getTime() < STALE_THRESHOLD_MS)
        );
    };

    const unsubResponders = onSnapshot(
      collection(db, 'responder_locations'),
      (snap) => {
        const active = filterActive(snap.docs as any);
        setResponders((prev) => mergeLocations(prev, active));
        setLoading(false);
      },
      (err) => {
        console.error('[ResponderLocationsScreen] responder_locations error:', err);
        setLoading(false);
      }
    );

    const unsubTanods = onSnapshot(
      collection(db, 'tanod_locations'),
      (snap) => {
        const active = filterActive(snap.docs as any);
        setResponders((prev) => mergeLocations(prev, active));
        setLoading(false);
      },
      (err) => {
        console.error('[ResponderLocationsScreen] tanod_locations error:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubResponders();
      unsubTanods();
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMyIncidents(uid, setIncidents);
    return () => unsub();
  }, [uid]);

  const activeIncident = incidents.find((i) => i.status !== 'resolved') ?? incidents[0];
  const onTheWayUids = useMemo(() => {
    const set = new Set<string>();
    activeIncident?.respondersOnTheWay?.forEach((r) => set.add(r.uid));
    return set;
  }, [activeIncident]);

  // Combine live responder_locations with any respondersOnTheWay on the active incident
  const displayResponders = useMemo(() => {
    const byUid = new Map<
      string,
      {
        uid: string;
        displayName: string;
        latitude: number;
        longitude: number;
        isOnTheWay: boolean;
        lastSeen?: Timestamp;
      }
    >();

    for (const r of responders) {
      byUid.set(r.uid, {
        uid: r.uid,
        displayName: r.displayName || 'Barangay Responder',
        latitude: r.latitude,
        longitude: r.longitude,
        isOnTheWay: onTheWayUids.has(r.uid) || r.status === 'on_the_way',
        lastSeen: r.lastSeen,
      });
    }

    for (const r of activeIncident?.respondersOnTheWay ?? []) {
      if (!byUid.has(r.uid)) {
        byUid.set(r.uid, {
          uid: r.uid,
          displayName: r.displayName || 'Barangay Responder',
          latitude: r.latitude,
          longitude: r.longitude,
          isOnTheWay: true,
        });
      }
    }

    // Show responders on the way first
    return Array.from(byUid.values()).sort((a, b) => {
      if (a.isOnTheWay !== b.isOnTheWay) return a.isOnTheWay ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [responders, activeIncident, onTheWayUids]);

  const handleOpenMap = (latitude: number, longitude: number) => {
    const url = `https://maps.google.com/?q=${latitude},${longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Google Maps.')
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      </View>

      <Text style={styles.title}>Responder Locations</Text>
      <Text style={styles.subtitle}>
        Real-time GPS coordinates of active barangay responders. Tap any responder to view their location on Google Maps.
      </Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#D32F2F" />
          <Text style={styles.loadingText}>Loading responder locations...</Text>
        </View>
      ) : displayResponders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Active Responders Visible</Text>
          <Text style={styles.emptyText}>
            No responders are currently broadcasting their live location. Once a responder goes on duty or heads to your alert, their location will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {displayResponders.map((r) => (
            <View
              key={r.uid}
              style={[styles.card, r.isOnTheWay && styles.cardOnTheWay]}
            >
              <View style={styles.cardTop}>
                <View style={styles.nameRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: r.isOnTheWay ? '#DC2626' : '#10B981' },
                    ]}
                  />
                  <Text style={styles.name}>{r.displayName}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    r.isOnTheWay ? styles.badgeOnTheWay : styles.badgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      r.isOnTheWay ? styles.badgeTextOnTheWay : styles.badgeTextActive,
                    ]}
                  >
                    {r.isOnTheWay ? 'On the way' : 'Active'}
                  </Text>
                </View>
              </View>

              <Text style={styles.coords}>
                {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
              </Text>

              <View style={styles.cardFooter}>
                {r.lastSeen ? (
                  <Text style={styles.updatedText}>
                    Updated {formatRelativeTime(r.lastSeen)}
                  </Text>
                ) : (
                  <Text style={styles.updatedText}>Live location</Text>
                )}

                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() => handleOpenMap(r.latitude, r.longitude)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.mapBtnText}>View on Google Maps →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  centerBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    gap: 8,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  list: {
    gap: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 8,
  },
  cardOnTheWay: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeOnTheWay: {
    backgroundColor: '#FEE2E2',
  },
  badgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextOnTheWay: {
    color: '#991B1B',
  },
  badgeTextActive: {
    color: '#065F46',
  },
  coords: {
    fontSize: 13,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  updatedText: {
    fontSize: 12,
    color: '#6B7280',
  },
  mapBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  mapBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
