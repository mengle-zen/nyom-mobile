import { useEffect, useState, type ReactNode } from 'react'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/api/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'

const TEST_EMAIL = process.env.EXPO_PUBLIC_TEST_LOGIN_EMAIL
const TEST_PASSWORD = process.env.EXPO_PUBLIC_TEST_LOGIN_PASSWORD

/**
 * OAuth 리디렉트 목적지. `app.json`의 `expo.scheme`과 같아야 하고,
 * Supabase의 Authentication → URL Configuration → Redirect URLs에 등록돼 있어야 한다.
 *
 * `Linking.createURL('/auth/callback')`을 쓰면 안 된다. dev server에 붙은 빌드에서는
 * 패키저 호스트가 URL 호스트로 끼어들어 `nyom://192.168.0.10:8081/auth/callback`이 된다
 * (expo-linking의 `createURL`이 `Constants.expoConfig.hostUri`를 끼워 넣는데, dev build
 * 에서는 `isExpoHosted()`가 false라 그 값이 지워지지 않는다).
 *
 * 그 주소는 허용목록에 없으므로 Supabase가 조용히 무시하고 Site URL(웹앱)로 되돌린다.
 * 그래서 카카오 로그인 자체는 성공하는데 앱이 아니라 브라우저에 착지한다.
 * 프로덕션 빌드에서는 hostUri가 비어 정상 동작하기 때문에 개발 중에만 재현되고,
 * IP가 바뀔 때마다 주소도 바뀌어 허용목록에 등록하는 것도 답이 아니다.
 */
const OAUTH_REDIRECT_URL = 'nyom://auth/callback'

export const hasTestLogin = Boolean(TEST_EMAIL && TEST_PASSWORD)

/**
 * OAuth 콜백 딥링크(nyom://auth/callback#access_token=...)에서 세션을 만든다.
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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
    })
    if (error) throw error
    if (!data.url) throw new Error('OAuth URL을 받지 못했어요')

    // 인앱 브라우저(ASWebAuthenticationSession / Custom Tabs)로 열어야
    // 로그인 세션 쿠키가 공유되고 콜백이 앱으로 되돌아온다.
    const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URL)
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
