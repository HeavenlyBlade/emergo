/**
 * AlertScreen — Emergency Alert (Module 2)
 *
 * Residents can send emergency alerts with:
 * - GPS coordinates card (no react-native-maps needed)
 * - Severity picker (light / moderate / extreme)
 * - Optional description field (up to 200 chars)
 * - The existing send button (slightly smaller)
 * - Recent alerts list
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from '../hooks/useLocation';
import { submitEmergencyAlert, subscribeToMyIncidents } from '../services/incidentService';
import { STATUS_COLORS, STATUS_LABELS, formatRelativeTime, formatResponseTime } from '../utils/incidentUtils';
import type { IncidentDocument } from '../types';

type Severity = 'light' | 'moderate' | 'extreme';

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string; bg: string }[] = [
  { value: 'light',    label: 'Light',    color: '#92400E', bg: '#FEF3C7' },
  { value: 'moderate', label: 'Moderate', color: '#9A3412', bg: '#FFEDD5' },
  { value: 'extreme',  label: 'Extreme',  color: '#991B1B', bg: '#FEE2E2' },
];

export default function AlertScreen() {
  const { uid, userDoc } = useAuth();
  const { coords, loading: locationLoading, error: locationError } = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [incidents, setIncidents] = useState<IncidentDocument[]>([]);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('moderate');

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMyIncidents(uid, setIncidents);
    return () => unsub();
  }, [uid]);

  const handleOpenMaps = () => {
    if (!coords) return;
    const url = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Google Maps.')
    );
  };

  const handleSendAlert = async () => {
    Alert.alert(
      'Send Emergency Alert?',
      'This will send your current location to barangay officials. Only use this for real emergencies.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await submitEmergencyAlert(
                uid!,
                description.trim() || undefined,
                severity
              );
              Alert.alert(
                'Alert Sent ✅',
                'Your emergency alert has been sent. Barangay officials have been notified.'
              );
              setDescription('');
              setSeverity('moderate');
            } catch (error: any) {
              const message =
                error?.message === 'GPS_TIMEOUT'
                  ? 'Could not get your location. Please enable GPS or try again.'
                  : error?.message ?? 'Please try again.';
              Alert.alert('Could not send alert', message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>{userDoc?.displayName ?? '...'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Resident</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Barangay Marketview</Text>
      </View>

      {/* GPS Coordinates Card */}
      <View style={styles.locationCard}>
        <Text style={styles.locationLabel}>📍 Your Location</Text>
        {locationLoading ? (
          <Text style={styles.locationValue}>Getting your location...</Text>
        ) : locationError ? (
          <Text style={styles.locationError}>{locationError}</Text>
        ) : coords ? (
          <>
            <Text style={styles.locationValue}>
              {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
            </Text>
            <TouchableOpacity onPress={handleOpenMaps}>
              <Text style={styles.locationLink}>View location on Google Maps →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.locationValue}>Location unavailable</Text>
        )}
      </View>

      {/* Severity picker */}
      <View style={styles.severitySection}>
        <Text style={styles.sectionLabel}>Emergency Level</Text>
        <View style={styles.severityRow}>
          {SEVERITY_OPTIONS.map((opt) => {
            const isSelected = severity === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.severityBtn,
                  isSelected
                    ? { backgroundColor: opt.bg, borderColor: opt.color }
                    : styles.severityBtnOutline,
                ]}
                onPress={() => setSeverity(opt.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.severityText,
                    { color: isSelected ? opt.color : '#6B7280' },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Description input */}
      <View style={styles.descSection}>
        <TextInput
          style={styles.descInput}
          placeholder="Describe the emergency (optional)"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, 200))}
          multiline
          textAlignVertical="top"
          numberOfLines={3}
        />
        <Text style={styles.charCount}>{description.length}/200</Text>
      </View>

      {/* Warning box */}
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠️ Only use for real emergencies. False alerts are a violation of barangay rules.
        </Text>
      </View>

      {/* Alert button */}
      <TouchableOpacity
        style={[styles.alertButton, submitting && styles.alertButtonDisabled]}
        onPress={handleSendAlert}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <>
            <Text style={styles.alertIcon}>!</Text>
            <Text style={styles.alertButtonText}>SEND EMERGENCY ALERT</Text>
            <Text style={styles.alertButtonSub}>Tap to send your location to officials</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Recent alerts */}
      {incidents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Recent Alerts</Text>
          {incidents.map((incident) => (
            <View key={incident.id} style={styles.incidentCard}>
              <View style={styles.incidentRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: STATUS_COLORS[incident.status] },
                  ]}
                />
                <Text style={styles.statusText}>
                  {STATUS_LABELS[incident.status]}
                </Text>
                {incident.severity && (
                  <Text style={[
                    styles.severityTag,
                    incident.severity === 'light' ? styles.severityTagLight :
                    incident.severity === 'moderate' ? styles.severityTagModerate :
                    styles.severityTagExtreme,
                  ]}>
                    {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                  </Text>
                )}
                <Text style={styles.timeText}>
                  {formatRelativeTime(incident.reportedAt as Timestamp)}
                </Text>
              </View>
              {incident.description ? (
                <Text style={styles.description}>{incident.description}</Text>
              ) : null}
              {incident.verifiedAt && (
                <Text style={styles.responseTime}>
                  Responded in {formatResponseTime(
                    incident.reportedAt as Timestamp,
                    incident.verifiedAt as Timestamp
                  )}
                </Text>
              )}
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
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  locationCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  locationValue: {
    fontSize: 13,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  locationError: {
    fontSize: 13,
    color: '#EF4444',
  },
  locationLink: {
    fontSize: 13,
    color: '#1D4ED8',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  severitySection: { gap: 8 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  severityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  severityBtnOutline: {
    backgroundColor: '#fff',
    borderColor: '#D1D5DB',
  },
  severityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  descSection: { gap: 4 },
  descInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111',
    minHeight: 72,
  },
  charCount: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  alertButton: {
    backgroundColor: '#D32F2F',
    width: '100%',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  alertButtonDisabled: { opacity: 0.6 },
  alertIcon: { fontSize: 52, fontWeight: '900', color: '#fff' },
  alertButtonText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  alertButtonSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  section: { width: '100%', gap: 8, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  incidentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  incidentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  severityTag: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  severityTagLight:    { backgroundColor: '#FEF3C7', color: '#92400E' },
  severityTagModerate: { backgroundColor: '#FFEDD5', color: '#9A3412' },
  severityTagExtreme:  { backgroundColor: '#FEE2E2', color: '#991B1B' },
  timeText: { fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' },
  description: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  responseTime: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 4 },
});
