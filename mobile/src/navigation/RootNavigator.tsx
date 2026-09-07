/**
 * RootNavigator
 *
 * Watches session state via useAuth and renders either:
 *   - AuthStack when signed out
 *   - AppStack when signed in with a complete profile
 *
 * onAuthSuccess is passed to auth screens so they can trigger
 * a session refresh after login without direct navigation coupling.
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

function AuthNavigator({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <AuthStack.Screen name="OtpVerify">
        {(props) => <OtpVerifyScreen {...props} onAuthSuccess={onAuthSuccess} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="DisplayNameSetup">
        {() => <DisplayNameSetupScreen onAuthSuccess={onAuthSuccess} />}
      </AuthStack.Screen>
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
  const { uid, userDoc, loading, refresh } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#D32F2F" />
      </View>
    );
  }

  const isAuthenticated = !!uid && !!userDoc?.displayName;

  return (
    <NavigationContainer>
      {isAuthenticated
        ? <AppNavigator />
        : <AuthNavigator onAuthSuccess={refresh} />
      }
    </NavigationContainer>
  );
}
