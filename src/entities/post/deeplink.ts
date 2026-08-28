import { MEAL_SLOTS } from './board'
import { offsetFromDate } from './date-range'

/** 푸시 알림 딥링크가 가리키는 보드 위치. */
export type DeeplinkTarget = { dateOffset: number; slotIdx: number }

/**
 * 'YYYY-MM-DD' → 로컬 자정 Date. 형식이 틀리거나 실재하지 않는 날짜면 null.
 * 서버(트리거)가 KST 로컬 날짜로 만들어 보내므로 로컬 타임존으로 해석한다.
 */
export function parseLocalDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  // 2026-02-31처럼 없는 날짜는 다음 달로 롤오버되므로 역검증한다.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null
  }
  return date
}

/**
 * 알림 딥링크의 date/slot 파라미터 → 보드 초기 위치.
 * 값이 없거나 미래·범위 초과·알 수 없는 슬롯이면 오늘/첫 끼니로 폴백한다.
 */
export function deeplinkTarget(
  params: { date?: string; slot?: string },
  now: Date,
  maxOffset: number,
): DeeplinkTarget {
  const date = parseLocalDate(params.date)
  const offset = date === null ? -1 : offsetFromDate(date, now)
  const slotIdx = MEAL_SLOTS.findIndex((s) => s.key === params.slot)
  return {
    dateOffset: offset >= 0 && offset <= maxOffset ? offset : 0,
    slotIdx: slotIdx >= 0 ? slotIdx : 0,
  }
}
