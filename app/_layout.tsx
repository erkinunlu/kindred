import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/contexts/AuthContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import 'react-native-url-polyfill/auto';

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <FilterProvider>
          <NotificationsProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pending-approval" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="user/[id]" />
        </Stack>
          </NotificationsProvider>
          </FilterProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
