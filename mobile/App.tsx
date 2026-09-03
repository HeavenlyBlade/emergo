/**
 * EMERGO — Expo Push Notifications Spike
 *
 * This is a throwaway test screen (Phase 0 spike).
 * Purpose: confirm Expo push token generation and delivery on a physical device.
 * Replace this with the real app once the spike passes.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Handle incoming notifications while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    Alert.alert(
      'Physical device required',
      'Expo push tokens only work on real devices, not simulators.'
    );
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert(
      'Permission denied',
      'Notification permission was not granted. Enable it in device settings.'
    );
    return null;
  }

  // projectId is required for Expo Go and standalone builds
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return tokenData.data;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Listen for incoming notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const title = notification.request.content.title ?? '(no title)';
        const body = notification.request.content.body ?? '(no body)';
        setLastNotification(`${title}: ${body}`);
      }
    );
    return () => subscription.remove();
  }, []);

  const handleGetToken = async () => {
    setLoading(true);
    const t = await registerForPushNotifications();
    setToken(t);
    setLoading(false);
    if (t) {
      console.log('=== EXPO PUSH TOKEN ===');
      console.log(t);
      console.log('======================');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🚨 Emergo</Text>
      <Text style={styles.subtitle}>Phase 0 — Push Notification Spike</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleGetToken}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Get Expo Push Token</Text>
        )}
      </TouchableOpacity>

      {token ? (
        <View style={styles.tokenBox}>
          <Text style={styles.tokenLabel}>✅ Token generated</Text>
          <Text style={styles.tokenText} selectable>
            {token}
          </Text>
          <Text style={styles.hint}>
            Copy this token and paste it into the Expo Push Tool at
            expo.dev/notifications to send a test notification.
          </Text>
        </View>
      ) : null}

      {lastNotification ? (
        <View style={styles.notifBox}>
          <Text style={styles.notifLabel}>📬 Notification received:</Text>
          <Text style={styles.notifText}>{lastNotification}</Text>
        </View>
      ) : null}

      <Text style={styles.note}>
        Must run on a physical device — tokens don't work on simulators.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#D32F2F',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  tokenBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    width: '100%',
    gap: 8,
  },
  tokenLabel: {
    fontWeight: '700',
    color: '#16a34a',
  },
  tokenText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  notifBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    width: '100%',
    gap: 4,
  },
  notifLabel: {
    fontWeight: '700',
    color: '#3b82f6',
  },
  notifText: {
    fontSize: 14,
    color: '#333',
  },
  note: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
