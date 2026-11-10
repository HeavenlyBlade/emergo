/**
 * OtpVerifyScreen
 *
 * Step 2 of the auth flow.
 * User enters the 6-digit code received via SMS.
 * Shows a 30-second countdown, then enables Resend code.
 * On success, navigates based on mode: register goes to DisplayNameSetup if needed;
 * signin always goes straight to Home.
 */

import { useState, useEffect, useRef } from 'react';
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
import { confirmOtp, sendOtp } from '../services/authService';
import { AuthStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
  route: RouteProp<AuthStackParamList, 'OtpVerify'>;
  onAuthSuccess: () => void;
};

export default function OtpVerifyScreen({ navigation, route, onAuthSuccess }: Props) {
  const { phoneNumber, mode } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCountdown();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(30);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendOtp(phoneNumber);
      startCountdown();
      Alert.alert('Code sent', `A new code was sent to ${phoneNumber}`);
    } catch (error: any) {
      Alert.alert('Could not resend', error?.message ?? 'Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your SMS.');
      return;
    }

    setLoading(true);
    try {
      const userDoc = await confirmOtp(phoneNumber, otp);
      if (mode === 'register' && !userDoc.displayName) {
        navigation.navigate('DisplayNameSetup');
      } else {
        onAuthSuccess();
      }
    } catch (error: any) {
      Alert.alert('Verification failed', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>Emergo</Text>
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

      {/* Resend section */}
      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={[styles.resendLink, resending && styles.resendDisabled]}>
              {resending ? 'Sending...' : 'Resend code'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
    paddingTop: Platform.OS === 'android' ? 56 : 44,
    gap: 14,
  },
  logo: { fontSize: 22, fontWeight: '800', color: '#D32F2F' },
  title: { fontSize: 26, fontWeight: '700', color: '#D32F2F' },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  phone: { fontWeight: '700', color: '#111' },
  input: {
    width: '100%',
    height: 64,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 10,
    color: '#111',
  },
  button: {
    backgroundColor: '#D32F2F',
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resendRow: { alignItems: 'center', marginTop: 4 },
  resendCountdown: { fontSize: 13, color: '#9CA3AF' },
  resendLink: { fontSize: 14, color: '#D32F2F', fontWeight: '600' },
  resendDisabled: { opacity: 0.5 },
  back: { color: '#D32F2F', fontSize: 14, marginTop: 4 },
});
