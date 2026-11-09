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

import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useIncidents } from '../hooks/useIncidents';
import { signOut } from '../services/authService';
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
  const { userDoc, refresh } = useAuth();
  const [filter, setFilter] = useState<IncidentStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  // L8 fix: refreshKey forces re-mount of the incidents subscription on manual refresh.
  // Data is already real-time via onSnapshot, so this is a manual override for edge cases.
  const [refreshKey, setRefreshKey] = useState(0);
  const { incidents, loading } = useIncidents(refreshKey);

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
          <Text style={styles.headerTitle}>Incident Monitor</Text>
          <Text style={styles.headerSub}>
            Hi, {userDoc?.displayName ?? '...'} · Tanod
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
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
            {loading ? 'Loading incidents...' : 'No incidents found.'}
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
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  signOut: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
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
    borderRadius: 8,
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
});
