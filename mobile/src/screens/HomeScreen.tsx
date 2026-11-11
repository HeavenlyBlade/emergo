/**
 * HomeScreen — role-based router
 *
 * Residents → AlertScreen
 * Officials → OfficialScreen (mobile incident monitor)
 */

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import { AppStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const { userDoc, refresh } = useAuth();

  useEffect(() => {
    if (!userDoc) return;
    if (userDoc.role === 'resident') {
      navigation.replace('Alert');
    } else if (userDoc.role === 'official') {
      navigation.replace('Official');
    }
  }, [userDoc, navigation]);

  const handleSignOut = async () => {
    await signOut();
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>E</Text>
      <Text style={styles.title}>Emergo</Text>
      <Text style={styles.welcome}>
        Welcome, {userDoc?.displayName ?? '...'}
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
  logo: { fontSize: 52, fontWeight: '900', color: '#D32F2F' },
  title: { fontSize: 28, fontWeight: '700', color: '#D32F2F' },
  welcome: { fontSize: 18, fontWeight: '600', color: '#111' },
  signOut: { marginTop: 24 },
  signOutText: { color: '#D32F2F', fontSize: 14, fontWeight: '600' },
});
