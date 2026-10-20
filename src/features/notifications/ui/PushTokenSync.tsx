import { useEffect } from 'react'
import { useAuth } from '@/features/auth'
import { getPushPermissionStatus, registerForPushNotifications } from '../register'

/**
 * 알림 권한이 이미 허용돼 있으면 로그인할 때마다 이 기기의 푸시 토큰을 서버에 맞춘다.
 *
 * 「이 기기에서 알림 켜기」 버튼은 권한이 허용되면 숨는다. 그런데 권한은 허용됐는데
 * 토큰이 서버에 없는 기기가 생긴다 — Expo 프로젝트 연결 전 빌드에서 권한만 받고 토큰
 * 발급은 실패했거나, 다른 계정으로 다시 로그인했거나, 서버에서 만료 토큰을 지운 경우다.
 * 그런 기기는 버튼이 없어 다시 등록할 길이 없었다(빌드 8에서 실제로 발생).
 *
 * 권한을 **새로 묻지는 않는다** — 허용된 경우에만 조용히 등록한다(토큰 저장은 upsert).
 * 화면을 그리지 않는다.
 */
export function PushTokenSync() {
  const { user } = useAuth()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let alive = true
    void getPushPermissionStatus().then((status) => {
      if (alive && status === 'granted') void registerForPushNotifications(userId)
    })
    return () => {
      alive = false
    }
  }, [userId])

  return null
}
