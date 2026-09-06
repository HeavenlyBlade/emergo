/**
 * RootNavigator
 *
 * Watches auth state via useAuth and renders either:
 *   - AuthStack (PhoneEntry → OtpVerify → DisplayNameSetup) when signed out
 *   - AppStack  (Home → ...) when signed in with a complete profile
 *
 * The transition between stacks is automatic — no manual navigation calls needed.
 */

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import PhoneEntryScreen from '../screens/PhoneEntryScreen';
import OtpVerifyScreen from '../screens/OtpVerifyScreen';
import DisplayNameSetupScreen from '../screens/DisplayNameSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import { AuthStackParamList, AppStackParamList } from '../types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <AuthStack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <AuthStack.Screen name="DisplayNameSetup" component={DisplayNameSetupScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Home" component={HomeScreen} />
    </AppStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, userDoc, loading } = useAuth();

  // Show spinner while determining auth state on app launch
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#D32F2F" />
      </View>
    );
  }

  const isAuthenticated = !!user && !!userDoc?.displayName;

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
