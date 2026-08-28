import { useEffect, useState, type ReactNode } from 'react'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/api/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'

const TEST_EMAIL = process.env.EXPO_PUBLIC_TEST_LOGIN_EMAIL
const TEST_PASSWORD = process.env.EXPO_PUBLIC_TEST_LOGIN_PASSWORD

export const hasTestLogin = Boolean(TEST_EMAIL && TEST_PASSWORD)

/**
 * OAuth 콜백 딥링크(nyomapp://auth/callback#access_token=...)에서 세션을 만든다.
 * 웹은 supabase-js가 URL을 자동으로 읽지만(detectSessionInUrl), RN에는 주소창이
 * 없어 우리가 직접 파싱해 넘겨야 한다.
 */
async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams(url)
  if (errorCode) throw new Error(errorCode)

  const { access_token, refresh_token } = params
  if (!access_token || !refresh_token) return null

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })
  if (error) throw error
  return data.session
}

/** 딥링크의 쿼리스트링과 프래그먼트를 함께 읽는다(공급자마다 위치가 다르다). */
function QueryParams(url: string): {
  params: Record<string, string>
  errorCode: string | null
} {
  const parsed = Linking.parse(url)
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed.queryParams ?? {})) {
    if (typeof v === 'string') params[k] = v
  }
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  for (const pair of hash.split('&')) {
    const [k, v] = pair.split('=')
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v)
  }
  return { params, errorCode: params.error_code ?? null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // 앱이 죽어 있는 동안 도착한 딥링크와, 살아있을 때 오는 딥링크를 모두 처리한다.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) void createSessionFromUrl(url).catch(() => {})
    })
    const sub = Linking.addEventListener('url', ({ url }) => {
      void createSessionFromUrl(url).catch(() => {})
    })
    return () => sub.remove()
  }, [])

  const signInWithKakao: AuthContextValue['signInWithKakao'] = async () => {
    const redirectTo = Linking.createURL('/auth/callback')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error) throw error
    if (!data.url) throw new Error('OAuth URL을 받지 못했어요')

    // 인앱 브라우저(ASWebAuthenticationSession / Custom Tabs)로 열어야
    // 로그인 세션 쿠키가 공유되고 콜백이 앱으로 되돌아온다.
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type === 'success') await createSessionFromUrl(result.url)
  }

  const signInWithTestAccount: AuthContextValue['signInWithTestAccount'] = async () => {
    if (!TEST_EMAIL || !TEST_PASSWORD) return
    const { error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (error) throw error
  }

  const signOut: AuthContextValue['signOut'] = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithKakao,
        signInWithTestAccount,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
