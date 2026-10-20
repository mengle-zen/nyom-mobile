import '@/global.css'

import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { ActivityIndicator, View } from 'react-native'
import { Toaster } from 'sonner-native'

import { queryClient } from '@/shared/api/query-client'
import { AuthProvider, useAuth } from '@/features/auth'
import { NotificationDeepLinks, PushTokenSync } from '@/features/notifications'
import { useReducedMotion } from '@/shared/ui/motion'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="auto" />
            <AuthGate />
            {/* shared/lib/error.ts의 notifyError가 이 Toaster로 뜬다. */}
            {/* 토스트는 높이 0인 컨테이너 안에 absolute로 놓인다. Android는 부모 밖으로 넘친
                뷰를 접근성 트리에서 빼서 TalkBack·e2e가 「되돌리기」를 못 찾는다 — 토스트
                한 장이 들어갈 높이를 준다. 컨테이너는 box-none이라 빈 곳 터치는 통과한다. */}
            <Toaster position="top-center" style={{ minHeight: 160 }} />
            {/* 알림 탭 → 보드 딥링크. 렌더 없음, 리스너만 붙는다. */}
            <NotificationDeepLinks />
            <PushTokenSync />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/**
 * 세션 유무에 따라 라우트 그룹을 전환한다.
 *
 * 웹앱은 라우트의 `beforeLoad`에서 세션을 봤는데, TanStack Router가 context 변경만으로는
 * 이미 로드된 라우트의 `beforeLoad`를 다시 실행하지 않아 로그인 후 화면이 안 넘어가는
 * 버그가 있었다(docs/UX_FINDINGS.md F항). 여기서는 세션을 렌더 트리의 상태로 두고
 * effect에서 직접 이동시켜 그 문제가 재현되지 않게 한다.
 */
function AuthGate() {
  const { session, loading } = useAuth()
  const reduceMotion = useReducedMotion()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    // 'auth'(OAuth 콜백)도 포함해야 한다 — 딥링크로 들어온 직후엔 아직 세션이
    // 없어서, 제외하지 않으면 세션이 만들어지기 전에 /login으로 쫓겨난다.
    const inAuthFlow =
      segments[0] === 'login' ||
      segments[0] === 'onboarding' ||
      (segments[0] as string) === 'auth'
    // 루트("/")는 src/app/index.tsx가 선언적으로 갈라 준다. 여기서는 그 외 경로만 본다.
    if (!session && !inAuthFlow) router.replace('/login')
    // OAuth 콜백 화면(auth/callback)에서도 세션이 생기면 넘긴다 — Android는 카카오 로그인 뒤
    // Custom Tab이 딥링크로 이 화면을 연다(iOS는 openAuthSessionAsync가 가로채 거치지 않음).
    // 빠뜨리면 로그인은 됐는데 「로그인 처리 중」에 영원히 멈춘다.
    else if (session && (segments[0] === 'login' || (segments[0] as string) === 'auth'))
      router.replace('/(app)/groups')
  }, [session, loading, segments, router])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFCF8' },
        // 화면 전환은 플랫폼 기본을 그대로 쓴다. 사용자는 OS 전체에서 이미 그 속도와
        // 곡선(뒤로 스와이프와 맞물리는 것까지)에 익숙하다 — JS에서 길이를 바꾸면
        // 이 앱만 미묘하게 어긋난다. 동작 줄이기를 켰으면 미는 대신 페이드.
        animation: reduceMotion ? 'fade' : 'default',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      {/*
        앱 셸에서는 엣지 스와이프 뒤로가기를 끈다.

        보드의 날짜 이동이 "오른쪽으로 밀면 과거"인데, 그게 iOS의 왼쪽 엣지
        뒤로가기 제스처와 같은 동작이다. 켜두면 보드 왼쪽에서 시작한 날짜
        스와이프가 OS 제스처에 가로채여 (app)이 pop되고, index가 다시
        /groups로 리다이렉트해 그룹 목록으로 튕긴다.

        여기서 뒤로 갈 곳도 없다 — 스택 아래는 index(리다이렉트 전용)뿐이다.
      */}
      {/*
        (app)에는 로그인·온보딩에서 replace로만 들어온다. 위계가 생기는 게 아니므로
        옆에서 밀려오는 push가 아니라 페이드로 바꿔 끼운다.
      */}
      <Stack.Screen name="(app)" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="auth/callback" />
      {/*
        업로드는 흐름을 잠깐 덮는 전체화면 모달이다. 옆에서 밀려오는 push가
        아니라 아래에서 올라와야 "잠시 들렀다 돌아간다"로 읽힌다 — 네이티브 모달
        표현이 그 전환을 그대로 해 준다.
      */}
      <Stack.Screen name="upload" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  )
}
