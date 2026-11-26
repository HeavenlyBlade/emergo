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

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from '../hooks/useLocation';
import { submitEmergencyAlert, subscribeToMyIncidents } from '../services/incidentService';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  formatRelativeTime,
  formatResponseTime,
  calculateDistanceMeters,
  formatDistance,
} from '../utils/incidentUtils';
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
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [chipExpanded, setChipExpanded] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const prevStatusMapRef = useRef<Record<string, string>>({});
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(`emergo_read_verifs_${uid}`)
      .then((raw) => {
        if (raw) setReadNotifIds(JSON.parse(raw));
      })
      .catch(() => {});

    const unsub = subscribeToMyIncidents(uid, (list) => {
      // Detect real-time unverified -> verified transitions and fire a local phone notification
      if (initialLoadDoneRef.current) {
        for (const inc of list) {
          const prevStatus = prevStatusMapRef.current[inc.id];
          if (inc.status === 'verified' && prevStatus && prevStatus !== 'verified') {
            Notifications.scheduleNotificationAsync({
              content: {
                title: '✅ Emergency Alert Verified',
                body:
                  inc.adminMessage ||
                  'Your emergency has been received and verified. You have been heard and responders will arrive shortly.',
                sound: 'default',
              },
              trigger: null,
            }).catch(() => {});
          }
        }
      }
      const nextMap: Record<string, string> = {};
      for (const inc of list) nextMap[inc.id] = inc.status;
      prevStatusMapRef.current = nextMap;
      initialLoadDoneRef.current = true;
      setIncidents(list);
    });
    return () => unsub();
  }, [uid]);

  const verifiedIncidents = incidents.filter(
    (i) => i.status === 'verified' || !!i.verifiedAt || !!i.adminMessage
  );
  const unreadCount = verifiedIncidents.filter((i) => !readNotifIds.includes(i.id)).length;

  const handleOpenNotifications = () => {
    setNotifModalVisible(true);
    if (uid && verifiedIncidents.length > 0) {
      const allIds = Array.from(new Set([...readNotifIds, ...verifiedIncidents.map((i) => i.id)]));
      setReadNotifIds(allIds);
      AsyncStorage.setItem(`emergo_read_verifs_${uid}`, JSON.stringify(allIds)).catch(() => {});
    }
  };

  // Active / most recent alert
  const activeIncident = incidents.find((i) => i.status !== 'resolved') ?? incidents[0];
  const respondersOnTheWay = activeIncident?.respondersOnTheWay ?? [];
  const responderCount = respondersOnTheWay.length;

  const closestDistance =
    responderCount > 0 && (activeIncident?.location || coords)
      ? Math.min(
          ...respondersOnTheWay.map((r) =>
            calculateDistanceMeters(
              r.latitude,
              r.longitude,
              activeIncident?.location?.latitude ?? coords!.latitude,
              activeIncident?.location?.longitude ?? coords!.longitude
            )
          )
        )
      : null;

  const handleOpenMaps = () => {
    if (!coords) return;
    const url = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Google Maps.')
    );
  };

  const handleAddPhoto = () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => launchCamera() },
        { text: 'Choose from Library', onPress: () => launchLibrary() },
      ]
    );
  };

  const processImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Error', 'Could not read photo data. Please try again.');
      return;
    }
    if (asset.base64.length > 900 * 1024) {
      Alert.alert(
        'Photo Too Large',
        'Photo is too large. Please retake with better lighting or closer to the subject.'
      );
      return;
    }
    setPhotoBase64(asset.base64);
    setPhotoUri(asset.uri);
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.4,
      base64: true,
    });
    processImageResult(result);
  };

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library access is required to choose photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.4,
      base64: true,
    });
    processImageResult(result);
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
                severity,
                photoBase64 ?? undefined
              );
              Alert.alert(
                'Alert Sent ✅',
                'Your emergency alert has been sent. Barangay officials have been notified.'
              );
              setDescription('');
              setSeverity('moderate');
              setPhotoBase64(null);
              setPhotoUri(null);
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
      {/* Top Bar with Upper-Right Verification Notification Bell */}
      <View style={styles.topUtilityBar}>
        <Text style={styles.topBrand}>Emergo</Text>
        <TouchableOpacity
          style={styles.notifBellBtn}
          onPress={handleOpenNotifications}
          activeOpacity={0.75}
          accessibilityLabel="Verification Notifications"
        >
          <Text style={styles.notifBellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Center Upper Section: Responder Indicator Chip & Admin Message */}
      <View style={styles.upperCenterSection}>
        {/* Responder Chip */}
        <TouchableOpacity
          style={[
            styles.responderChip,
            responderCount > 0
              ? styles.responderChipActive
              : activeIncident?.status === 'verified'
              ? styles.responderChipVerified
              : activeIncident
              ? styles.responderChipPending
              : styles.responderChipStandby,
          ]}
          onPress={() => responderCount > 0 && setChipExpanded(!chipExpanded)}
          activeOpacity={responderCount > 0 ? 0.75 : 1}
        >
          <View style={styles.chipInnerRow}>
            <Text style={styles.chipEmoji}>
              {responderCount > 0 ? '🚨' : activeIncident?.status === 'verified' ? '🛡️' : activeIncident ? '⏳' : '📡'}
            </Text>
            <Text
              style={[
                styles.chipText,
                responderCount > 0
                  ? styles.chipTextActive
                  : activeIncident?.status === 'verified'
                  ? styles.chipTextVerified
                  : styles.chipTextDefault,
              ]}
            >
              {responderCount > 0
                ? `${responderCount} ${responderCount === 1 ? 'Responder' : 'Responders'} on the way · ${closestDistance !== null ? formatDistance(closestDistance) + ' away' : 'en route'}`
                : activeIncident?.status === 'verified'
                ? 'Alert Verified · Responders dispatching'
                : activeIncident
                ? 'Emergency Alert Sent · Awaiting verification'
                : 'Emergency Response Active'}
            </Text>
            {responderCount > 0 && (
              <Text style={styles.chipChevron}>{chipExpanded ? '▲' : '▼'}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Expanded Responder details */}
        {chipExpanded && responderCount > 0 && (
          <View style={styles.expandedResponderBox}>
            <Text style={styles.expandedResponderTitle}>Approaching Field Responders:</Text>
            {respondersOnTheWay.map((r) => {
              const dist = activeIncident?.location
                ? calculateDistanceMeters(
                    r.latitude,
                    r.longitude,
                    activeIncident.location.latitude,
                    activeIncident.location.longitude
                  )
                : null;
              return (
                <View key={r.uid} style={styles.responderRow}>
                  <Text style={styles.responderName}>👤 {r.displayName}</Text>
                  <Text style={styles.responderDistance}>
                    {dist !== null ? `${formatDistance(dist)} away` : 'On the way'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Admin Verification Message */}
        {activeIncident?.adminMessage && (
          <View style={styles.adminMessageCard}>
            <View style={styles.adminMessageHeader}>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>BARANGAY OFFICIAL MESSAGE</Text>
              </View>
              {activeIncident.adminMessageSentAt && (
                <Text style={styles.adminMessageTime}>
                  {formatRelativeTime(activeIncident.adminMessageSentAt as Timestamp)}
                </Text>
              )}
            </View>
            <Text style={styles.adminMessageText}>
              "{activeIncident.adminMessage}"
            </Text>
          </View>
        )}
      </View>

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

      {/* Photo section */}
      {photoUri ? (
        <View style={styles.photoPreviewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.photoPreview}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.removePhotoBtn}
            onPress={() => { setPhotoBase64(null); setPhotoUri(null); }}
          >
            <Text style={styles.removePhotoBtnText}>✕ Remove</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.photoButton}
          onPress={handleAddPhoto}
          activeOpacity={0.7}
        >
          <Text style={styles.photoButtonIcon}>📷</Text>
          <Text style={styles.photoButtonText}>Add Photo (optional)</Text>
        </TouchableOpacity>
      )}

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

      {/* Verification Notifications Modal */}
      <Modal
        visible={notifModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verification Notifications</Text>
              <TouchableOpacity
                onPress={() => setNotifModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 10 }}>
              {verifiedIncidents.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  No verified alert notifications yet. When a barangay official verifies your alert, it will appear here.
                </Text>
              ) : (
                verifiedIncidents.map((inc) => (
                  <View key={inc.id} style={styles.notifItem}>
                    <View style={styles.notifItemTop}>
                      <Text style={styles.notifItemStatus}>✅ Alert Verified</Text>
                      <Text style={styles.notifItemTime}>
                        {formatRelativeTime((inc.verifiedAt ?? inc.reportedAt) as Timestamp)}
                      </Text>
                    </View>
                    <Text style={styles.notifItemMsg}>
                      {inc.adminMessage ||
                        'Your emergency alert has been received and verified by barangay officials. Responders will arrive shortly.'}
                    </Text>
                    {inc.description ? (
                      <Text style={styles.notifItemDesc} numberOfLines={2}>
                        Alert: {inc.description}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  photoButton: {
    height: 100,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoButtonIcon: { fontSize: 28 },
  photoButtonText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  photoPreviewContainer: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  removePhotoBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  /* Center Upper Section & Responder Chip */
  upperCenterSection: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  responderChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: '100%',
  },
  responderChipActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  responderChipVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  responderChipPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  responderChipStandby: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  chipInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#B91C1C',
  },
  chipTextVerified: {
    color: '#065F46',
  },
  chipTextDefault: {
    color: '#4B5563',
  },
  chipChevron: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 2,
  },
  expandedResponderBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    gap: 8,
  },
  expandedResponderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    textTransform: 'uppercase',
  },
  responderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  responderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  responderDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  adminMessageCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 14,
    gap: 6,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  adminMessageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminBadge: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adminMessageTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  adminMessageText: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
    color: '#1E3A8A',
    lineHeight: 18,
  },

  /* Upper-Right Verification Notification Bell & Modal */
  topUtilityBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D32F2F',
    letterSpacing: 0.5,
  },
  notifBellBtn: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  notifBellIcon: {
    fontSize: 19,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '700',
  },
  modalBody: {
    width: '100%',
  },
  modalEmpty: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 20,
  },
  notifItem: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    gap: 4,
  },
  notifItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifItemStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  notifItemTime: {
    fontSize: 11,
    color: '#047857',
  },
  notifItemMsg: {
    fontSize: 13,
    color: '#064E3B',
    fontWeight: '500',
    lineHeight: 18,
  },
  notifItemDesc: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
});
