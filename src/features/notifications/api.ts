import { supabase } from '@/shared/api/supabase'
import type { NotificationSettingsRow } from '@/types/database'
import { toSettingsColumns, type NotificationSettings } from './lib/settings'

/**
 * 내 알림 설정 조회. 행이 없으면 null을 반환하고(에러 아님) 호출자가
 * `toNotificationSettings(null)`로 기본값(전부 수신)을 쓴다.
 */
export async function fetchNotificationSettings(
  userId: string,
): Promise<NotificationSettingsRow | null> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('user_id, post_enabled, reaction_enabled, reminder_enabled, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as NotificationSettingsRow | null) ?? null
}

/**
 * 내 알림 설정 저장. 행이 없을 수 있으므로 upsert(PK = user_id).
 * 한 종류만 바뀌어도 세 값을 함께 쓴다 — 부분 업데이트로는 행이 없을 때
 * 나머지 컬럼이 DB default(true)로 채워져 화면과 어긋날 수 있다.
 */
export async function updateNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): Promise<void> {
  const { error } = await supabase
    .from('notification_settings')
    // supabase-js 2.106 generic 추론 우회. 런타임 안전.
    .upsert(
      {
        user_id: userId,
        ...toSettingsColumns(settings),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

export type SaveExpoTokenParams = {
  userId: string
  token: string
  platform: 'ios' | 'android'
  deviceId: string | null
}

/**
 * Expo push token 저장.
 *
 * 웹의 `push_subscriptions`(endpoint/p256dh/auth)에 밀어넣지 않고 전용 테이블에
 * 넣는다 — 두 프로토콜은 필드도 발송 경로도 다르고, 섞으면 web-push 발송까지
 * 오염된다. 근거와 대안 검토는
 * `supabase/migrations/20260828030000_expo_push_tokens.sql` 주석에 있다.
 *
 * ⚠️ 그 마이그레이션은 아직 적용되지 않았다. 테이블이 없으면 PostgREST가
 * PGRST205/42P01을 돌려주는데, 여기서 삼키지 않고 그대로 던진다 —
 * "알림이 켜진 것처럼 보이지만 실제로는 아무데도 저장되지 않은" 상태가
 * 조용히 만들어지는 쪽이 훨씬 나쁘다.
 */
export async function saveExpoPushToken({
  userId,
  token,
  platform,
  deviceId,
}: SaveExpoTokenParams): Promise<void> {
  const { error } = await supabase
    .from('expo_push_tokens')
    // supabase-js 2.106 generic 추론 우회. 런타임 안전.
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        device_id: deviceId,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'token' },
    )
  if (error) throw error
}
