/**
 * PhoneEntryScreen
 *
 * Step 1 of the mobile auth flow.
 * Two tabs:
 *   - Login: Phone number + Password (NO SMS OTP)
 *     Includes "Forgot password?" (last-resort SMS OTP for residents)
 *   - Register: Residents verify phone once via SMS OTP, then set name & password
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
import {
  sendOtp,
  checkUserExists,
  signInWithPhonePassword,
  getUserRoleByPhone,
} from '../services/authService';
import { AuthStackParamList } from '../types';

type Mode = 'register' | 'signin';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PhoneEntry'>;
  onAuthSuccess: () => void;
};

export default function PhoneEntryScreen({ navigation, onAuthSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getValidatedNumber = (): string | null => {
    const cleaned = digits.replace(/\D/g, '');
    if (cleaned.length !== 10 || !cleaned.startsWith('9')) {
      Alert.alert(
        'Invalid number',
        'Enter a valid 10-digit Philippine mobile number starting with 9 (e.g. 9171234567).'
      );
      return null;
    }
    return '+63' + cleaned;
  };

  const handleSubmit = async () => {
    const fullNumber = getValidatedNumber();
    if (!fullNumber) return;

    if (mode === 'signin') {
      if (!password.trim()) {
        Alert.alert('Password required', 'Enter your password to log in.');
        return;
      }
      setLoading(true);
      try {
        await signInWithPhonePassword(fullNumber, password);
        onAuthSuccess();
      } catch (error: any) {
        const code = error?.code ?? '';
        if (code === 'auth/network-request-failed' || error?.message?.includes('network')) {
          Alert.alert(
            'No Internet Connection',
            'Could not reach the server. Please check your internet connection and try again.'
          );
        } else {
          Alert.alert('Login failed', error?.message ?? 'Incorrect phone number or password.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Register mode (resident one-time SMS OTP)
    setLoading(true);
    try {
      const exists = await checkUserExists(fullNumber);
      if (exists) {
        Alert.alert(
          'Account already exists',
          'This number is already registered. Please switch to the Login tab.'
        );
        setLoading(false);
        return;
      }

      await sendOtp(fullNumber);
      navigation.navigate('OtpVerify', { phoneNumber: fullNumber, mode: 'register' });
    } catch (error: any) {
      const code = error?.code ?? '';
      if (code === 'auth/network-request-failed' || error?.message?.includes('network')) {
        Alert.alert(
          'No Internet Connection',
          'Could not reach the server. Please check your internet connection and try again.'
        );
      } else {
        Alert.alert(
          'Could not send code',
          error?.message ?? 'Failed to send verification code. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const fullNumber = getValidatedNumber();
    if (!fullNumber) return;

    setLoading(true);
    try {
      const role = await getUserRoleByPhone(fullNumber);
      if (!role) {
        Alert.alert('No account found', 'No account found for this number. Please register first.');
        setLoading(false);
        return;
      }
      if (role !== 'resident') {
        Alert.alert(
          'Contact Barangay Official',
          'Responders and officials must ask an admin or official to reset their password on the dashboard.'
        );
        setLoading(false);
        return;
      }

      await sendOtp(fullNumber);
      navigation.navigate('OtpVerify', { phoneNumber: fullNumber, mode: 'reset' });
    } catch (error: any) {
      Alert.alert(
        'Could not send code',
        error?.message ?? 'Failed to send password reset code. Please try again.'
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
        {mode === 'signin'
          ? 'Sign in with your mobile number and password'
          : 'Residents: verify your mobile number once to register'}
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
          returnKeyType={mode === 'signin' ? 'next' : 'done'}
          onSubmitEditing={mode === 'register' ? handleSubmit : undefined}
        />
      </View>

      {/* Password input (Login tab only) */}
      {mode === 'signin' && (
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={styles.showBtn}
          >
            <Text style={styles.showBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === 'signin' ? 'Log in' : 'Send verification code'}
          </Text>
        )}
      </TouchableOpacity>

      {mode === 'signin' ? (
        <TouchableOpacity
          onPress={handleForgotPassword}
          disabled={loading}
          style={styles.forgotBtn}
        >
          <Text style={styles.forgotText}>Forgot password? (Reset via SMS)</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.note}>You'll receive a one-time 6-digit SMS code.</Text>
      )}
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
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#D32F2F',
    letterSpacing: 1,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#D32F2F' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    width: '100%',
    marginBottom: 12,
  },
  prefix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    paddingRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#111',
    letterSpacing: 1,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    width: '100%',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  showBtn: {
    paddingLeft: 10,
    paddingVertical: 6,
  },
  showBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D32F2F',
  },
  button: {
    backgroundColor: '#D32F2F',
    width: '100%',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgotBtn: {
    marginTop: 16,
    paddingVertical: 6,
  },
  forgotText: {
    fontSize: 13,
    color: '#D32F2F',
    fontWeight: '600',
  },
  note: { fontSize: 12, color: '#999', marginTop: 16 },
});
