import 'react-native-url-polyfill/auto'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nkljdcgddtzbwwycqpiq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rbGpkY2dkZHR6Ynd3eWNxcGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODU2NDgsImV4cCI6MjEwMTM2MTY0OH0.jTT-1q-D4y2fbVSKxmv4MvFZ4OoGNP6rAxbQJnHg5WE'

// Op native (iOS/Android app) bewaren we de sessie in AsyncStorage.
// Op web laten we Supabase zijn eigen localStorage gebruiken — die blijft
// bewaard, ook als de PWA vanaf het beginscherm volledig herstart.
const auth =
  Platform.OS === 'web'
    ? { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    : { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth })
