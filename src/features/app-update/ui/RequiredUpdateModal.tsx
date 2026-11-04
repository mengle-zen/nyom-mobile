import { useEffect, useState } from 'react'
import { AppState, Linking, Modal, Platform, Text, View } from 'react-native'
import Constants from 'expo-constants'
import Feather from '@expo/vector-icons/Feather'

import { PressableScale } from '@/shared/ui/press'
import { APP_VERSION_URL, needsUpdate, parseUpdatePolicy, type UpdatePolicy } from '../lib/policy'

/** 설치된 바이너리의 빌드 번호. 네이티브 빌드 때 app.json 값으로 생성된 설정을 읽는다. */
function currentBuild(): string | number | undefined {
  const config = Constants.expoConfig
  return Platform.OS === 'ios' ? config?.ios?.buildNumber : config?.android?.versionCode
}

async function fetchPolicy(): Promise<UpdatePolicy | null> {
  try {
    const res = await fetch(APP_VERSION_URL, { cache: 'no-store' })
    if (!res.ok) return null
    return parseUpdatePolicy(await res.json(), Platform.OS)
  } catch {
    // 오프라인·웹 장애로 앱을 막지 않는다.
    return null
  }
}

/**
 * 이 빌드가 더는 동작하지 않으면 닫을 수 없는 업데이트 안내를 띄운다.
 *
 * 로그인 전에도 떠야 해서(옛 서버로는 로그인도 실패한다) 인증과 무관하게 루트에 둔다.
 * 켤 때와 앱으로 돌아올 때마다 확인한다 — 쓰는 도중 기준이 올라가도 다음 복귀 때 뜬다.
 */
export function RequiredUpdateModal() {
  const [policy, setPolicy] = useState<UpdatePolicy | null>(null)

  useEffect(() => {
    // 개발 중에는 설치된 개발용 바이너리의 빌드 번호가 뒤처져 있기 일쑤라 검사하지 않는다.
    if (__DEV__) return
    let alive = true
    const check = () => {
      void fetchPolicy().then((next) => {
        if (alive) setPolicy(needsUpdate(currentBuild(), next) ? next : null)
      })
    }
    check()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check()
    })
    return () => {
      alive = false
      sub.remove()
    }
  }, [])

  if (!policy) return null

  return (
    // onRequestClose를 비워 Android 뒤로 가기로도 닫히지 않게 한다.
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(31,27,22,0.45)' }}>
        <View
          accessibilityViewIsModal
          className="w-full max-w-sm items-center rounded-xl bg-background px-6 pb-6 pt-7"
        >
          <View className="mb-4 size-16 items-center justify-center rounded-2xl bg-primary-100">
            <Feather name="download" size={30} color="#FF7A2E" />
          </View>
          <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
            업데이트가 필요해요
          </Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-muted-foreground">
            이 버전은 더 이상 쓸 수 없어요.{'\n'}새 버전으로 업데이트해 주세요.
          </Text>
          <PressableScale
            onPress={() => void Linking.openURL(policy.url).catch(() => {})}
            accessibilityRole="button"
            // PressableScale은 바깥 Animated.View가 폭을 정한다 — 부모가 items-center라 늘려 줘야 한다.
            style={{ alignSelf: 'stretch' }}
            className="mt-6 h-control w-full items-center justify-center rounded-lg bg-primary"
          >
            <Text className="text-base font-bold text-white">업데이트하기</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  )
}
