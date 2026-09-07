/**
 * HomeScreen — placeholder
 *
 * This screen is a placeholder for now.
 * It will be replaced with the actual resident home screen in Module 2 (Emergency Alert).
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';

export default function HomeScreen() {
  const { userDoc, refresh } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🚨</Text>
      <Text style={styles.title}>Emergo</Text>
      <Text style={styles.welcome}>
        Welcome, {userDoc?.displayName || 'loading...'}
      </Text>
      <Text style={styles.role}>
        Role: <Text style={styles.roleBadge}>{userDoc?.role}</Text>
      </Text>
      <Text style={styles.note}>
        Module 1 (Auth) ✅{'\n'}
        Module 2 (Emergency Alert) — coming next
      </Text>
      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  logo: { fontSize: 52 },
  title: { fontSize: 28, fontWeight: '700', color: '#D32F2F' },
  welcome: { fontSize: 18, fontWeight: '600', color: '#111' },
  role: { fontSize: 14, color: '#555' },
  roleBadge: { fontWeight: '700', color: '#D32F2F' },
  note: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
  },
  signOut: { marginTop: 24 },
  signOutText: { color: '#D32F2F', fontSize: 14, fontWeight: '600' },
});
