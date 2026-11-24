/**
 * TanodScreen — Mobile view for tanods
 *
 * Tanods are field responders who carry phones, not laptops.
 * They can:
 *   - See all incidents in real time
 *   - View incident location and status
 *   - Open the location in Google Maps
 *
 * They CANNOT:
 *   - Verify incidents (only officials can)
 *   - Resolve incidents (only officials can)
 *
 * Role gate is enforced in Firestore rules — this UI just
 * reflects the correct permissions without hiding it confusingly.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Timestamp } from 'firebase/firestore';
import * as Location from 'expo-location';
import { useAuth } from '../hooks/useAuth';
import { useIncidents } from '../hooks/useIncidents';
import { signOut } from '../services/authService';
import { startLocationBroadcast } from '../services/tanodLocationService';
import { setResponderOnTheWay } from '../services/incidentService';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  formatRelativeTime,
  formatFullDate,
  formatResponseTime,
} from '../utils/incidentUtils';
import type { IncidentDocument, IncidentStatus } from '../types';

const FILTER_OPTIONS: { label: string; value: IncidentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unverified', value: 'unverified' },
  { label: 'Verified', value: 'verified' },
  { label: 'Resolved', value: 'resolved' },
];

export default function TanodScreen() {
  const { uid, userDoc, refresh } = useAuth();
  const [filter, setFilter] = useState<IncidentStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  // L8 fix: refreshKey forces re-mount of the incidents subscription on manual refresh.
  // Data is already real-time via onSnapshot, so this is a manual override for edge cases.
  const [refreshKey, setRefreshKey] = useState(0);
  const { incidents, loading } = useIncidents(refreshKey);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);

  useEffect(() => {
    if (userDoc?.role !== 'tanod' && userDoc?.role !== 'responder') return;
    if (!uid || !broadcastEnabled) {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      return;
    }

    startLocationBroadcast(uid, userDoc.displayName ?? '')
      .then((sub) => {
        locationSubRef.current = sub;
      })
      .catch((err) => {
        console.error('[TanodScreen] Location broadcast failed:', err);
      });

    return () => {
      locationSubRef.current?.remove();
    };
  }, [uid, userDoc?.role, broadcastEnabled]);

  const handleToggleOnTheWay = async (incident: IncidentDocument) => {
    if (!uid) return;
    const isOnTheWay = incident.respondersOnTheWay?.some((r) => r.uid === uid);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await setResponderOnTheWay(
        incident.id,
        {
          uid,
          displayName: userDoc?.displayName ?? 'Responder',
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
        !isOnTheWay
      );
      Alert.alert(
        !isOnTheWay ? 'Status: On The Way 🚨' : 'Status Updated',
        !isOnTheWay
          ? 'You are marked as On The Way! Location shared with resident.'
          : 'You are no longer marked on the way.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update response status.');
    }
  };

  const filtered = filter === 'all'
    ? incidents
    : incidents.filter((i) => i.status === filter);

  const unverifiedCount = incidents.filter(
    (i) => i.status === 'unverified'
  ).length;

  const handleOpenMap = (lat: number, lng: number) => {
    const url = `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Google Maps.')
    );
  };

  const handleSignOut = async () => {
    await signOut();
    refresh();
  };

  const renderIncident = ({ item }: { item: IncidentDocument }) => {
    const isExpanded = expanded === item.id;
    const color = STATUS_COLORS[item.status];

    return (
      <TouchableOpacity
        style={[styles.card, isExpanded && styles.cardExpanded]}
        onPress={() => setExpanded(isExpanded ? null : item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={[styles.statusText, { color }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
          {item.severity && (
            <Text style={[
              styles.severityLabel,
              item.severity === 'light'
                ? { color: '#92400E', backgroundColor: '#FEF3C7' }
                : item.severity === 'moderate'
                ? { color: '#9A3412', backgroundColor: '#FFEDD5' }
                : { color: '#991B1B', backgroundColor: '#FEE2E2' },
            ]}>
              {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
            </Text>
          )}
          <Text style={styles.timeText}>
            {formatRelativeTime(item.reportedAt as Timestamp)}
          </Text>
        </View>

        {item.description ? (
          <Text style={styles.description} numberOfLines={isExpanded ? 0 : 1}>
            {item.description}
          </Text>
        ) : (
          <Text style={styles.descriptionEmpty}>Emergency alert</Text>
        )}

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.detailLabel}>Reported:</Text>
            <Text style={styles.detailValue}>
              {formatFullDate(item.reportedAt as Timestamp)}
            </Text>

            {item.verifiedAt && (
              <>
                <Text style={styles.detailLabel}>Verified:</Text>
                <Text style={styles.detailValue}>
                  {formatFullDate(item.verifiedAt as Timestamp)}
                </Text>
                <Text style={styles.responseTime}>
                  Response: {formatResponseTime(item.reportedAt as Timestamp, item.verifiedAt as Timestamp)}
                </Text>
              </>
            )}

            {item.location && (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() =>
                  handleOpenMap(
                    item.location.latitude,
                    item.location.longitude
                  )
                }
              >
                <Text style={styles.mapButtonText}>Open in Google Maps</Text>
              </TouchableOpacity>
            )}

            {item.photoBase64 && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }}
                style={styles.incidentPhoto}
                resizeMode="cover"
              />
            )}

            {/* On the way action button */}
            <TouchableOpacity
              style={[
                styles.onTheWayBtn,
                item.respondersOnTheWay?.some((r) => r.uid === uid) && styles.onTheWayBtnActive,
              ]}
              onPress={() => handleToggleOnTheWay(item)}
            >
              <Text style={[
                styles.onTheWayBtnText,
                item.respondersOnTheWay?.some((r) => r.uid === uid) && styles.onTheWayBtnTextActive,
              ]}>
                {item.respondersOnTheWay?.some((r) => r.uid === uid)
                  ? '✓ You are On The Way (Tap to Cancel)'
                  : '🚨 On The Way'}
              </Text>
            </TouchableOpacity>

            <View style={styles.roleNote}>
              <Text style={styles.roleNoteText}>
                Verification and resolution are handled by barangay officials.
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Incident Monitor</Text>
            {unverifiedCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unverifiedCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSub}>
            Hi, {userDoc?.displayName ?? '...'} · Tanod
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.toggleBtn, broadcastEnabled ? styles.toggleBtnActive : styles.toggleBtnInactive]}
            onPress={() => setBroadcastEnabled(!broadcastEnabled)}
          >
            <Text style={[styles.toggleBtnText, broadcastEnabled ? styles.toggleBtnTextActive : styles.toggleBtnTextInactive]}>
              {broadcastEnabled ? '📍 Visible' : '⚪ Hidden'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Alert badge */}
      {unverifiedCount > 0 && (
        <View style={styles.alertBadge}>
          <Text style={styles.alertBadgeText}>
            {unverifiedCount} unverified incident
            {unverifiedCount > 1 ? 's' : ''} need attention
          </Text>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filters}>
        {FILTER_OPTIONS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterBtn,
              filter === f.value && styles.filterBtnActive,
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.value && styles.filterTextActive,
              ]}
            >
              {f.label}
              {f.value !== 'all' && (
                ` (${incidents.filter((i) => i.status === f.value).length})`
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderIncident}
        contentContainerStyle={styles.list}
        refreshControl={
          // L8 fix: was onRefresh={() => setFilter(filter)} which is a no-op (same value).
          // Data is already real-time via onSnapshot; refreshKey forces a listener re-mount
          // for edge cases where the real-time stream has stalled.
          <RefreshControl refreshing={loading} onRefresh={() => setRefreshKey(k => k + 1)} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading
              ? 'Loading incidents...'
              : 'No incidents reported. The area is clear.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#1F2937',
    paddingTop: Platform.OS === 'android' ? 56 : 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  signOut: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  alertBadge: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  alertBadgeText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterBtnActive: { backgroundColor: '#D32F2F' },
  filterText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  cardExpanded: {
    borderColor: '#D32F2F',
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  timeText: { fontSize: 11, color: '#9CA3AF' },
  description: { fontSize: 14, color: '#374151', lineHeight: 20 },
  descriptionEmpty: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  expandedContent: { marginTop: 12, gap: 4 },
  detailLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 6 },
  detailValue: { fontSize: 13, color: '#374151' },
  responseTime: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 2 },
  mapButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  mapButtonText: { color: '#1D4ED8', fontSize: 13, fontWeight: '600' },
  roleNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  roleNoteText: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 14 },
  severityLabel: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  incidentPhoto: { width: '100%', height: 140, borderRadius: 10, marginTop: 8 },
  onTheWayBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  onTheWayBtnActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  onTheWayBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  onTheWayBtnTextActive: {
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  toggleBtnInactive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#065F46',
  },
  toggleBtnTextInactive: {
    color: '#6B7280',
  },
});
