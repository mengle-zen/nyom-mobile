import { ActivityIndicator, Text, View } from 'react-native'

/**
 * Kakao OAuth 리디렉트 목적지(`nyom://auth/callback`).
 *
 * 세션 생성은 여기가 아니라 `features/auth/context.tsx`가 한다 — 딥링크를
 * `Linking` 리스너로 받아 `setSession()`까지 처리한다. 보통은
 * `WebBrowser.openAuthSessionAsync`가 리디렉트를 가로채므로 이 화면이 뜨지도 않는다.
 *
 * 이 라우트가 필요한 이유: 앱이 완전히 종료된 상태에서 콜백 딥링크가 오면
 * expo-router가 먼저 경로를 해석하는데, 라우트가 없으면 "Unmatched Route"가 뜬다.
 * 세션이 만들어지는 짧은 순간 동안 보여줄 화면이 있어야 한다.
 * 세션이 준비되면 `_layout.tsx`의 AuthGate가 그룹 화면으로 보낸다.
 */
export default function AuthCallbackScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator color="#FF7A2E" />
      <Text className="mt-3 text-sm text-muted-foreground">로그인 처리 중...</Text>
    </View>
  )
}
