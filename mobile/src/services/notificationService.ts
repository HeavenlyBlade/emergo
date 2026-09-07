/**
 * notificationService — Expo Push Notification fan-out
 *
 * Two responsibilities:
 *
 * 1. registerPushToken(uid)
 *    Called on login for officials and tanods.
 *    Retrieves the device's Expo push token and stores it in
 *    users/{uid}.expoPushToken in Firestore.
 *
 * 2. notifyOfficialsAndTanods(incidentId, reporterName)
 *    Called after a resident submits an emergency alert.
 *    Queries Firestore for all users with role == 'official' or 'tanod',
 *    collects their push tokens, and sends a batch push via Expo Push API.
 *    All devices are peers — none is primary.
 *
 * Per the steering file invariants:
 *   - No Cloud Functions, no FCM, no Blaze plan
 *   - All official/tanod devices are peer subscribers
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Token registration ───────────────────────────────────────────────────────

export async function registerPushToken(uid: string): Promise<void> {
  // Push tokens only work on physical devices
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Get the push token — projectId required for standalone/dev builds
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const token = tokenData.data;

  // Store in Firestore
  await updateDoc(doc(db, 'users', uid), {
    expoPushToken: token,
  });
}

// ─── Fan-out ──────────────────────────────────────────────────────────────────

export async function notifyOfficialsAndTanods(
  incidentId: string,
  reporterName: string,
  location: { latitude: number; longitude: number }
): Promise<void> {
  // Query all officials and tanods who have a push token
  const officialsQuery = query(
    collection(db, 'users'),
    where('role', 'in', ['official', 'tanod'])
  );

  const snap = await getDocs(officialsQuery);

  // Collect valid tokens
  const tokens: string[] = [];
  snap.forEach((d) => {
    const token = d.data().expoPushToken;
    if (token && typeof token === 'string' && token.startsWith('ExponentPushToken')) {
      tokens.push(token);
    }
  });

  if (tokens.length === 0) return;

  // Build batch push messages — Expo accepts up to 100 per request
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: '🚨 Emergency Alert',
    body: `${reporterName} has sent an emergency alert. Tap to view location.`,
    data: {
      incidentId,
      latitude: location.latitude,
      longitude: location.longitude,
    },
    priority: 'high',
    channelId: 'emergency-alerts',
  }));

  // Send in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });
  }
}
