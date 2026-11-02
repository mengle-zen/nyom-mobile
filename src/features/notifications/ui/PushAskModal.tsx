import { useEffect, useState } from 'react'
import { Linking, Modal, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/features/auth'
import { PressableScale } from '@/shared/ui/press'
import { parsePushAskState, shouldAskForPush, snoozePushAsk } from '../lib/push-ask'
import { ensureAndroidChannel, registerForPushNotifications } from '../register'

const STORAGE_KEY = 'push:ask'

/**
 * 알림이 꺼진 사람에게 그룹 화면에서 한 번 띄우는 안내 모달.
 *
 * 아직 시스템 창을 본 적 없으면 「알림 켜기」가 시스템 허용 창을 띄운다. iOS는 그 창을
 * 한 번만 띄울 수 있어서, 이미 거절한 사람에게는 같은 자리가 「설정에서 켜기」가 되어
 * 설정 앱을 연다(돌아오면 PushTokenSync가 권한 변화를 보고 등록한다).
 */
export function PushAskModal() {
  const { user } = useAuth()
  const userId = user?.id
  const [mode, setMode] = useState<'ask' | 'settings' | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    void (async () => {
      const permission = await Notifications.getPermissionsAsync()
      const state = parsePushAskState(await AsyncStorage.getItem(STORAGE_KEY).catch(() => null))
      if (alive && shouldAskForPush(state, permission.granted, Date.now())) {
        setMode(permission.canAskAgain ? 'ask' : 'settings')
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  const snooze = async () => {
    setMode(null)
    const state = parsePushAskState(await AsyncStorage.getItem(STORAGE_KEY).catch(() => null))
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snoozePushAsk(state, Date.now()))).catch(() => {})
  }

  const enable = async () => {
    if (mode === 'settings') {
      // 설정에서 켜고 돌아오지 않을 수도 있으니 미룬 것으로 센다 — 켜고 오면 다시 묻지 않는다.
      void snooze()
      void Linking.openSettings()
      return
    }
    await ensureAndroidChannel()
    const asked = await Notifications.requestPermissionsAsync()
    if (asked.granted && userId) {
      setMode(null)
      void registerForPushNotifications(userId)
    } else {
      void snooze()
    }
  }

  if (!mode) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void snooze()}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(31,27,22,0.45)' }}>
        <View
          accessibilityViewIsModal
          className="w-full max-w-sm items-center rounded-xl bg-background px-6 pb-5 pt-7"
        >
          <View className="mb-4 size-16 items-center justify-center rounded-2xl bg-primary-100">
            <Feather name="bell" size={30} color="#FF7A2E" />
          </View>
          <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
            알림을 켜 주세요
          </Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-muted-foreground">
            친구가 올린 한 끼와 내 사진에 남긴 반응을{'\n'}놓치지 않게 알려 드려요.
          </Text>
          {mode === 'settings' && (
            <Text className="mt-2 text-center text-[13px] leading-5 text-muted-foreground">
              설정 → 알림에서 「알림 허용」을 켜 주세요.
            </Text>
          )}
          <PressableScale
            onPress={() => void enable()}
            accessibilityRole="button"
            // PressableScale은 바깥 Animated.View가 폭을 정한다 — 부모가 items-center라 늘려 줘야 한다.
            style={{ alignSelf: 'stretch' }}
            className="mt-6 h-control w-full items-center justify-center rounded-lg bg-primary"
          >
            <Text className="text-base font-bold text-white">
              {mode === 'settings' ? '설정에서 켜기' : '알림 켜기'}
            </Text>
          </PressableScale>
          <PressableScale
            onPress={() => void snooze()}
            hapticKind={null}
            accessibilityRole="button"
            style={{ alignSelf: 'stretch' }}
            className="mt-1 h-control-sm w-full items-center justify-center"
          >
            <Text className="text-[15px] text-muted-foreground">다음에 할게요</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  )
}
