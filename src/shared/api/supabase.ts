import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import type { Database } from '@/types/database'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Supabase 환경변수가 없습니다. .env.local에 EXPO_PUBLIC_SUPABASE_URL과 ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 넣어주세요.',
  )
}

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    // 웹은 localStorage를 쓰지만 RN에는 없다. AsyncStorage로 세션을 영속화한다.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // RN에는 OAuth 리디렉트 URL을 담은 주소창이 없다. 딥링크를 직접 파싱해 세션을 만든다.
    detectSessionInUrl: false,
  },
})

// 백그라운드에서는 토큰 자동 갱신 타이머를 멈춘다.
// 안 멈추면 앱이 잠든 사이 갱신이 실패하며 불필요한 요청·에러가 쌓인다.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
