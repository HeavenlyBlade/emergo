/**
 * PhoneEntryScreen
 *
 * Step 1 of the auth flow.
 * Two tabs: Register (new user) and Sign In (existing user).
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
import { sendOtp, checkUserExists } from '../services/authService';
import { AuthStackParamList } from '../types';

type Mode = 'register' | 'signin';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PhoneEntry'>;
};

export default function PhoneEntryScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('register');
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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
      if (mode === 'signin') {
        const exists = await checkUserExists(fullNumber);
        if (!exists) {
          Alert.alert(
            'No account found',
            'No account found for this number. Please register first.'
          );
          setLoading(false);
          return;
        }
      }

      await sendOtp(fullNumber);
      navigation.navigate('OtpVerify', { phoneNumber: fullNumber, mode });
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
      <Text style={styles.helperText}>
        Use your mobile number to send emergency alerts to barangay officials
      </Text>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mode === 'signin' && styles.tabActive]}
          onPress={() => setMode('signin')}
        >
          <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
            Login
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'register' && styles.tabActive]}
          onPress={() => setMode('register')}
        >
          <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
            Register
          </Text>
        </TouchableOpacity>
      </View>

      {/* Phone input */}
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
          onSubmitEditing={handleSubmit}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === 'signin' ? 'Send code to log in' : 'Send verification code'}
          </Text>
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
    paddingTop: Platform.OS === 'android' ? 56 : 44,
    gap: 12,
  },
  logo: { fontSize: 24, fontWeight: '800', color: '#D32F2F' },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  tabRow: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    padding: 4,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#D32F2F' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    width: '100%',
    paddingHorizontal: 14,
    height: 56,
  },
  prefix: { fontSize: 16, color: '#333', marginRight: 6, fontWeight: '600' },
  input: { flex: 1, fontSize: 18, color: '#111', letterSpacing: 1 },
  button: {
    backgroundColor: '#D32F2F',
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, color: '#999', textAlign: 'center' },
});
