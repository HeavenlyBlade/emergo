/**
 * DisplayNameSetupScreen
 *
 * Handles both:
 *   - mode === 'register' (default): Set Full Name + Password after registration OTP
 *   - mode === 'reset': Set a new Password after "Forgot password?" SMS OTP
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
import type { RouteProp } from '@react-navigation/native';
import {
  getStoredSession,
  saveProfileAndPassword,
  resetPassword,
} from '../services/authService';
import { AuthStackParamList } from '../types';

type Props = {
  route: RouteProp<AuthStackParamList, 'DisplayNameSetup'>;
  onAuthSuccess: () => void;
};

export default function DisplayNameSetupScreen({ route, onAuthSuccess }: Props) {
  const mode = route.params?.mode ?? 'register';
  const isReset = mode === 'reset';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!isReset) {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        Alert.alert('Name too short', 'Please enter your full name.');
        return;
      }
    }

    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password.');
      return;
    }

    setLoading(true);
    try {
      const uid = await getStoredSession();
      if (!uid) throw new Error('No session found. Please log in again.');

      if (isReset) {
        await resetPassword(uid, password);
        Alert.alert('Password Updated', 'You can now use your new password to log in.');
      } else {
        await saveProfileAndPassword(uid, name.trim(), password);
      }
      onAuthSuccess();
    } catch (error: any) {
      const isNetwork = error?.code === 'auth/network-request-failed' || error?.message?.includes('network');
      Alert.alert(
        isNetwork ? 'No Internet Connection' : 'Could not save',
        isNetwork ? 'Please check your internet connection and try again.' : (error?.message ?? 'Please try again.')
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
      <Text style={styles.title}>
        {isReset ? 'Reset your password' : 'Complete your profile'}
      </Text>
      <Text style={styles.subtitle}>
        {isReset
          ? 'Enter a new password for your Emergo account.'
          : 'Set your full name and a password for future logins without SMS.'}
      </Text>

      {!isReset && (
        <TextInput
          style={styles.input}
          placeholder="Full name (e.g. Juan dela Cruz)"
          placeholderTextColor="#aaa"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Password (min. 6 characters)"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoFocus={isReset}
        returnKeyType="next"
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
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
          <Text style={styles.buttonText}>
            {isReset ? 'Save New Password' : 'Continue'}
          </Text>
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
  title: { fontSize: 26, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  input: {
    width: '100%',
    height: 54,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111',
  },
  button: {
    backgroundColor: '#D32F2F',
    width: '100%',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
