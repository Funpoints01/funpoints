import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFF8F0' },
      }}
    />
  );
}
