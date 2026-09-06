/**
 * OtpVerifyScreen
 *
 * Step 2 of 2 in the auth flow.
 * User enters the 6-digit code received via SMS.
 * On success, verifyOtp creates users/{uid} with role: 'resident' if first login,
 * then navigation is handled by the root navigator watching auth state.
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
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { confirmOtp } from '../services/authService';
import { pendingConfirmation } from './PhoneEntryScreen';
import { AuthStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
  route: RouteProp<AuthStackParamList, 'OtpVerify'>;
};

export default function OtpVerifyScreen({ navigation, route }: Props) {
  const { phoneNumber } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your SMS.');
      return;
    }

    if (!pendingConfirmation) {
      Alert.alert('Session expired', 'Go back and request a new code.');
      return;
    }

    setLoading(true);
    try {
      await confirmOtp(pendingConfirmation, otp);
      navigation.navigate('DisplayNameSetup');
    } catch (error: any) {
      const message = error?.code === 'auth/invalid-verification-code'
        ? 'Incorrect code. Check your SMS and try again.'
        : error?.code === 'auth/code-expired'
        ? 'The code has expired. Go back and request a new one.'
        : error?.message ?? 'Something went wrong. Please try again.';

      Alert.alert('Verification failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>🚨</Text>
      <Text style={styles.title}>Enter code</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to{'\n'}
        <Text style={styles.phone}>{phoneNumber}</Text>
      </Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor="#bbb"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
        textAlign="center"
        autoFocus
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Wrong number? Go back</Text>
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
    fontSize: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#D32F2F',
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  phone: {
    fontWeight: '700',
    color: '#111',
  },
  input: {
    width: '100%',
    height: 64,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 10,
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
  back: {
    color: '#D32F2F',
    fontSize: 14,
    marginTop: 4,
  },
});
