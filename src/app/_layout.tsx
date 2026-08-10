import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TaalProvider } from '../lib/i18n';

export default function RootLayout() {
  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <SafeAreaProvider>
      <TaalProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#FFF8F0' },
          }}
        />
      </TaalProvider>
    </SafeAreaProvider>
  );
}
