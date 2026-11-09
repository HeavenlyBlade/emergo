/**
 * PhoneEntryScreen
 *
 * Step 1 of 2 in the auth flow.
 * User enters their Philippine mobile number (+63...).
 * On submit, generates and sends an OTP via SMS API PH.
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
import { sendOtp } from '../services/authService';
import { AuthStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PhoneEntry'>;
};

export default function PhoneEntryScreen({ navigation }: Props) {
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const cleaned = digits.replace(/\D/g, '');

    if (cleaned.length !== 10 || !cleaned.startsWith('9')) {
      Alert.alert(
        'Invalid number',
        'Enter a valid 10-digit Philippine mobile number starting with 9 (e.g. 9171234567).'
      );
      return;
    }

    const fullNumber = '+63' + cleaned;
    setLoading(true);

    try {
      await sendOtp(fullNumber);
      navigation.navigate('OtpVerify', { phoneNumber: fullNumber });
    } catch (error: any) {
      Alert.alert(
        'Could not send code',
        error?.message ?? 'Failed to send verification code. Please try again.'
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
      <Text style={styles.logo}>Emergo</Text>
      <Text style={styles.title}>Emergo</Text>
      <Text style={styles.subtitle}>Enter your mobile number to continue</Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>+63</Text>
        <TextInput
          style={styles.input}
          placeholder="9171234567"
          placeholderTextColor="#aaa"
          keyboardType="phone-pad"
          maxLength={10}
          value={digits}
          onChangeText={(t) => setDigits(t.replace(/\D/g, ''))}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSendOtp}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendOtp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send verification code</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>You'll receive a 6-digit SMS code.</Text>
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
    gap: 12,
  },
  logo: { fontSize: 24, fontWeight: '800', color: '#D32F2F' },
  title: { fontSize: 28, fontWeight: '700', color: '#D32F2F' },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    width: '100%',
    paddingHorizontal: 14,
    height: 52,
  },
  prefix: { fontSize: 16, color: '#333', marginRight: 6, fontWeight: '600' },
  input: { flex: 1, fontSize: 18, color: '#111', letterSpacing: 1 },
  button: {
    backgroundColor: '#D32F2F',
    width: '100%',
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, color: '#999', textAlign: 'center' },
});
