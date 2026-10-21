/**
 * 'HH:mm' 시각 직접 입력의 순수 로직.
 *
 * 웹은 `<input type="time">`으로 끝났지만 RN에는 그런 기본 컨트롤이 없다.
 * 처음엔 ±5분·±1시간 스테퍼를 썼는데, 12:30으로 바꾸려면 여러 번 눌러야 해서
 * 불편했다(2026-10 시안 A′안 — 시·분 두 칸 직접 입력으로 바꿨다).
 * 계산은 전부 여기 모아 화면에서 분 단위 산술이 흩어지지 않게 한다.
 */

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

export type TimeInput =
  | { ok: true; value: string }
  | { ok: false; reason: 'incomplete' | 'hour' | 'minute' | 'future' }

/**
 * 시·분 두 칸에 친 숫자를 'HH:mm'으로. 한 자리는 앞에 0을 붙여 읽는다('9' → 09).
 * now-only 원칙 — max보다 늦으면 'future'(서버 RPC도 같은 검증을 한다).
 */
export function timeFromParts(hour: string, minute: string, max: string): TimeInput {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) {
    return { ok: false, reason: 'incomplete' }
  }
  const h = Number(hour)
  const m = Number(minute)
  if (h > 23) return { ok: false, reason: 'hour' }
  if (m > 59) return { ok: false, reason: 'minute' }
  const minutes = h * 60 + m
  const maxMinutes = parseHHmm(max)
  if (maxMinutes !== null && minutes > maxMinutes) return { ok: false, reason: 'future' }
  return { ok: true, value: formatHHmm(minutes) }
}
