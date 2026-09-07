/**
 * DisplayNameSetupScreen
 *
 * Shown once after first login when the user has no display name yet.
 * Collects the user's name and saves it to users/{uid}.displayName.
 * After saving, the root navigator redirects to the main app automatically.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import { saveDisplayName } from '../services/authService';

export default function DisplayNameSetupScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Name too short', 'Please enter your full name.');
      return;
    }

    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      Alert.alert('Error', 'No user session found. Please log in again.');
      return;
    }

    setLoading(true);
    try {
      await saveDisplayName(uid, trimmed);
      // useAuth hook will pick up the updated displayName and
      // the root navigator will redirect to Home automatically
    } catch (error: any) {
      Alert.alert(
        'Could not save name',
        error?.message ?? 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>👋</Text>
      <Text style={styles.title}>What's your name?</Text>
      <Text style={styles.subtitle}>
        This helps barangay officials identify you when you send an alert.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. Juan dela Cruz"
        placeholderTextColor="#aaa"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  logo: {
    fontSize: 52,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111',
  },
  button: {
    backgroundColor: '#D32F2F',
    width: '100%',
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
