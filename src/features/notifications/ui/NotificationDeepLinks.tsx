import { useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useAuth } from '@/features/auth'
import { boardHref } from '@/shared/lib/board-href'
import { configureNotificationHandler } from '../register'
import { normalizePushTarget, parsePushUrl } from '../lib/push-url'

/** 이미 소비한 알림 id. 앱을 껐다 켜도 같은 알림이 다시 열리지 않게 영속화한다. */
const CONSUMED_KEY = 'nyom:consumed-notification-id'

/**
 * 알림 탭 → 보드 이동. 렌더는 하지 않고 리스너만 붙인다.
 *
 * 두 경로를 모두 다룬다.
 *  - 앱이 죽어 있을 때 알림으로 실행: `getLastNotificationResponseAsync()`
 *  - 앱이 살아 있을 때 알림 탭:      `addNotificationResponseReceivedListener`
 *
 * 목적지 계산은 `lib/push-url`이 하고, 그 안에서 웹과 공유하는 순수 로직
 * `deeplinkTarget()`으로 미래·범위 초과·알 수 없는 끼니를 폴백시킨다.
 *
 * 주의 — `getLastNotificationResponseAsync()`는 "마지막 응답"을 OS가 계속 들고 있어서
 * 앱을 다시 켤 때마다 같은 값을 돌려준다. 처리 여부를 메모리에만 두면 실행할 때마다,
 * 그리고 fast refresh마다 며칠 전 알림이 되살아나 사용자를 보드로 끌고 간다.
 * 그래서 소비한 id를 AsyncStorage에 남겨 프로세스가 바뀌어도 한 번만 열리게 한다.
 */
export function NotificationDeepLinks() {
  const { session } = useAuth()
  const signedIn = !!session
  /** 이번 프로세스에서 이미 처리한 id — 초기 응답과 리스너가 겹칠 때의 중복 방지. */
  const handled = useRef<Set<string>>(new Set())

  useEffect(() => {
    configureNotificationHandler()
  }, [])

  useEffect(() => {
    // 로그인 전에는 보드로 보낼 수 없다(AuthGate가 즉시 로그인으로 되돌린다).
    if (!signedIn) return
    let alive = true

    const navigate = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | { url?: unknown }
        | undefined
      const target = normalizePushTarget(parsePushUrl(data?.url), new Date())

      // 그룹을 특정할 수 없는 알림(리마인더 등)은 그룹 목록으로 — 어느 보드를
      // 열어야 할지 모른 채 아무 그룹이나 여는 것보다 낫다.
      if (!target) {
        router.navigate('/(app)/groups')
        return
      }
      router.navigate(
        boardHref(target.group, { date: target.date, ...target.meal }),
      )
    }

    /** 사용자가 지금 탭한 알림. 항상 새 이동으로 취급한다. */
    const onTap = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier
      if (handled.current.has(id)) return
      handled.current.add(id)
      void AsyncStorage.setItem(CONSUMED_KEY, id).catch(() => {})
      navigate(response)
    }

    /** 앱이 알림으로 실행된 경우. 이전 실행에서 이미 연 알림이면 무시한다. */
    const onColdStart = async () => {
      const response = await Notifications.getLastNotificationResponseAsync()
      if (!alive || !response) return

      const id = response.notification.request.identifier
      if (handled.current.has(id)) return

      const consumed = await AsyncStorage.getItem(CONSUMED_KEY).catch(() => null)
      if (!alive || consumed === id) return

      handled.current.add(id)
      await AsyncStorage.setItem(CONSUMED_KEY, id).catch(() => {})
      navigate(response)
    }

    void onColdStart()
    const sub = Notifications.addNotificationResponseReceivedListener(onTap)
    return () => {
      alive = false
      sub.remove()
    }
  }, [signedIn])

  return null
}
