/**
 * 알림 켜기 안내 모달을 띄울지 정한다.
 *
 * 알림을 허용하지 않은 사람에게는 푸시를 보낼 수 없으니 앱 안에서 먼저 묻는다.
 * 「다음에」(또는 시스템 창에서 거절)는 7일 동안 다시 묻지 않고, 세 번 미루면 더는 묻지
 * 않는다 — 그 뒤로는 프로필의 알림 설정에만 남는다.
 */
export const PUSH_ASK_SNOOZE_DAYS = 7
export const PUSH_ASK_MAX_SNOOZES = 3

export type PushAskState = {
  /** 미룬 횟수 */
  snoozes: number
  /** 이 시각(ms) 전에는 묻지 않는다 */
  nextAt: number
}

export const INITIAL_PUSH_ASK: PushAskState = { snoozes: 0, nextAt: 0 }

export function shouldAskForPush(state: PushAskState, permissionGranted: boolean, now: number): boolean {
  if (permissionGranted) return false
  if (state.snoozes >= PUSH_ASK_MAX_SNOOZES) return false
  return now >= state.nextAt
}

export function snoozePushAsk(state: PushAskState, now: number): PushAskState {
  return { snoozes: state.snoozes + 1, nextAt: now + PUSH_ASK_SNOOZE_DAYS * 24 * 60 * 60 * 1000 }
}

/** AsyncStorage 값 → 상태. 깨진 값은 처음 상태로. */
export function parsePushAskState(raw: string | null): PushAskState {
  if (!raw) return INITIAL_PUSH_ASK
  try {
    const v = JSON.parse(raw) as Partial<PushAskState>
    if (typeof v.snoozes === 'number' && typeof v.nextAt === 'number') {
      return { snoozes: v.snoozes, nextAt: v.nextAt }
    }
  } catch {
    // 아래로
  }
  return INITIAL_PUSH_ASK
}
