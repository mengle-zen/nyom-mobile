/**
 * 'HH:mm' 시각 스테퍼의 순수 로직.
 *
 * 웹은 `<input type="time">`으로 끝났지만 RN에는 그런 기본 컨트롤이 없다.
 * 네이티브 휠 피커를 띄우는 대신 ± 버튼 스테퍼를 쓴다 — 기본값이 "지금"이라
 * 실제 조작은 몇 분~한두 시간 보정이 대부분이고, 스테퍼가 탭 수가 더 적다.
 * 계산은 전부 여기 모아 화면에서 분 단위 산술이 흩어지지 않게 한다.
 */

/** 분 스테퍼의 기본 간격. */
export const MINUTE_STEP = 5

const MINUTES_PER_DAY = 24 * 60

/** 'HH:mm' → 자정부터의 분. 형식이 틀리거나 범위를 벗어나면 null. */
export function parseHHmm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** 자정부터의 분 → 'HH:mm'. 하루를 넘어가면 [0, 1439]로 자른다. */
export function formatHHmm(minutes: number): string {
  const clamped = Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 'HH:mm'을 [00:00, max] 범위로 자른다.
 * now-only 원칙 — 아직 오지 않은 시각은 고를 수 없다(서버 RPC도 같은 검증을 한다).
 * 파싱 불가한 입력은 max로 되돌린다(입력이 깨진 채 저장되지 않게).
 */
export function clampTime(value: string, max: string): string {
  const minutes = parseHHmm(value)
  const maxMinutes = parseHHmm(max)
  if (minutes === null) return maxMinutes === null ? value : max
  if (maxMinutes === null) return formatHHmm(minutes)
  return formatHHmm(Math.min(minutes, maxMinutes))
}

/**
 * 'HH:mm'에 분을 더하고 [00:00, max]로 자른 결과.
 * 날짜를 넘기지 않는다 — 섭취 시각은 "기록한 날의 시:분"만 바꾸는 값이라
 * 23:59에서 +5분이 다음 날 00:04가 되면 안 된다(RPC가 RECORDED_AT_DATE_CHANGED로 거절).
 */
export function stepTime(value: string, deltaMinutes: number, max: string): string {
  const minutes = parseHHmm(value)
  if (minutes === null) return clampTime(value, max)
  return clampTime(formatHHmm(minutes + deltaMinutes), max)
}

/** 스테퍼 버튼 비활성 판정 — 눌러도 값이 안 바뀌면 비활성으로 보여준다. */
export function canStep(value: string, deltaMinutes: number, max: string): boolean {
  return stepTime(value, deltaMinutes, max) !== clampTime(value, max)
}
