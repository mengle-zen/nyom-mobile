import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/features/auth'

/**
 * 루트 라우트. 앱을 그냥 실행하면(`nyom://`, `exp://…/--/`) 여기로 온다.
 *
 * 이게 없으면 expo-router가 `+not-found`를 렌더해 사용자가 앱을 켜자마자
 * "Unmatched Route"를 본다. 레이아웃의 AuthGate가 뒤늦게 밀어내긴 하지만
 * 그 사이 깨진 화면이 한 번 보인다 — 첫인상이라 특히 나쁘다.
 * 여기서 선언적으로 갈라 그 깜빡임 자체를 없앤다.
 */
export default function IndexScreen() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#FF7A2E" />
      </View>
    )
  }

  return <Redirect href={session ? '/(app)/groups' : '/login'} />
}
