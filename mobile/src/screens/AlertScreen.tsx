/**
 * AlertScreen — Emergency Alert (Module 2)
 *
 * The primary screen for residents. One tap sends an emergency alert
 * with their current GPS location to Firestore.
 *
 * Option B offline behavior: if no connection, show clear error — no queueing.
 *
 * Shows the resident's recent alerts below the button so they can
 * track the status of their reports in real time.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { submitEmergencyAlert, subscribeToMyIncidents } from '../services/incidentService';
import { STATUS_COLORS, STATUS_LABELS, formatRelativeTime, formatResponseTime } from '../utils/incidentUtils';
import type { IncidentDocument } from '../types';

export default function AlertScreen() {
  const { uid, userDoc } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [incidents, setIncidents] = useState<IncidentDocument[]>([]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMyIncidents(uid, setIncidents);
    return () => unsub();
  }, [uid]);

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
              await submitEmergencyAlert(uid!);
              Alert.alert(
                'Alert Sent ✅',
                'Your emergency alert has been sent. Barangay officials have been notified.'
              );
            } catch (error: any) {
              // Option B: show clear error for offline or any failure
              // M6 fix: GPS_TIMEOUT gets a clear user message
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
      <Text style={styles.greeting}>
        Hello, {userDoc?.displayName ?? '...'}
      </Text>
      <Text style={styles.subtitle}>Barangay Marketview Emergency Alert</Text>

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

      <Text style={styles.warning}>
        Only use for real emergencies. False alerts are a violation of barangay rules.
      </Text>

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
                    incident.reportedAt as any,
                    incident.verifiedAt as any
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
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    alignSelf: 'flex-start',
    marginTop: -8,
  },
  alertButton: {
    backgroundColor: '#D32F2F',
    width: '100%',
    borderRadius: 16,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    marginTop: 8,
  },
  alertButtonDisabled: {
    opacity: 0.6,
  },
  alertIcon: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  alertButtonSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  warning: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
  section: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  incidentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  responseTime: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
});
