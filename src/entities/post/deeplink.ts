import { offsetFromDate } from './date-range'

/** 푸시 알림 딥링크가 가리키는 보드 위치. */
export type DeeplinkTarget = { dateOffset: number }

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
 * 알림 딥링크의 date 파라미터 → 보드 초기 날짜. 값이 없거나 미래·범위 초과면 오늘.
 * 서버 URL에는 아직 slot·tag가 실리지만 시간 띠 보드(2026-10-27)는 끼니로 나누지 않아 무시한다.
 */
export function deeplinkTarget(
  params: { date?: string },
  now: Date,
  maxOffset: number,
): DeeplinkTarget {
  const date = parseLocalDate(params.date)
  const offset = date === null ? -1 : offsetFromDate(date, now)
  return { dateOffset: offset >= 0 && offset <= maxOffset ? offset : 0 }
}
