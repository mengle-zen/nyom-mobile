import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { saveExpoPushToken } from './api'
import { getActiveChatGroup } from './lib/active-chat'
import { parsePushUrl } from './lib/push-url'

/**
 * 권한 요청 → Expo push token 획득 → 서버 저장.
 *
 * 네이티브로 옮긴 가장 큰 이유가 이 경로다. iOS Safari의 Web Push는 PWA를 홈 화면에
 * 추가한 경우에만 동작해서, 브라우저 탭으로 쓰는 iOS 사용자에게는 알림이 아예 가지
 * 않았다(docs/UX_FINDINGS.md G항). 네이티브에서는 APNs로 정상 전달된다.
 */

export type RegisterResult =
  /** 토큰까지 받아 서버에 저장 완료 */
  | 'registered'
  /** 사용자가 권한을 거부(또는 이전에 거부) */
  | 'denied'
  /** 시뮬레이터 등 원격 푸시 토큰을 발급받을 수 없는 환경 */
  | 'unsupported'
  /** 토큰은 받았지만 저장에 실패 (테이블 미적용 등) */
  | 'save-failed'

/**
 * 알림 표시 방식 — 앱이 떠 있을 때도 배너를 띄운다.
 * 단, 지금 보고 있는 방의 채팅 알림은 띄우지 않는다(목록에 이미 실시간으로 들어온다).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as { url?: unknown } | undefined
      const link = parsePushUrl(data?.url)
      const show = !(link.chat && link.group && link.group === getActiveChatGroup())
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      }
    },
  })
}

/** 현재 권한이 이미 허용돼 있는지 (설정 UI의 안내 줄 판단용) */
export async function getPushPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  const { status } = await Notifications.getPermissionsAsync()
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'
  return 'undetermined'
}

/**
 * EAS 프로젝트 id. `getExpoPushTokenAsync`가 요구한다.
 * app.json에 extra.eas.projectId가 없으면 undefined → 개발 빌드에서는 생략 가능.
 */
function easProjectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas as
    | { projectId?: string }
    | undefined
  return fromConfig?.projectId ?? Constants.easConfig?.projectId
}

/**
 * Android 기본 알림 채널. Android 13 이상은 채널이 하나도 없으면 권한 요청 창을 띄우지 않으므로
 * 권한을 묻기 **전에** 만든다.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: '기본',
    importance: Notifications.AndroidImportance.DEFAULT,
  })
}

export async function registerForPushNotifications(
  userId: string,
): Promise<RegisterResult> {
  // 시뮬레이터/에뮬레이터는 APNs·FCM 등록 자체가 불가능하다. 권한 팝업만 띄우고
  // 토큰 발급에서 예외가 나므로 미리 걸러 정확한 사유를 돌려준다.
  if (!Device.isDevice) return 'unsupported'

  await ensureAndroidChannel()
  const existing = await Notifications.getPermissionsAsync()
  let granted = existing.granted
  if (!granted && existing.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync()
    granted = asked.granted
  }
  if (!granted) return 'denied'

  let token: string
  try {
    const projectId = easProjectId()
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    token = result.data
  } catch (err) {
    console.warn('[push] Expo push token 발급 실패', err)
    return 'unsupported'
  }

  try {
    await saveExpoPushToken({
      userId,
      token,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      deviceId: Constants.sessionId ?? null,
    })
  } catch (err) {
    console.warn('[push] 토큰 저장 실패', err)
    return 'save-failed'
  }

  return 'registered'
}
