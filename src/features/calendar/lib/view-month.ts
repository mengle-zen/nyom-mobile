/**
 * "지금 보고 있는 달"(월 뷰)을 다루는 순수 로직.
 *
 * 회고 캘린더에서 표시 월과 선택일의 달이 어긋나면 — 예를 들어 기본 표시 월이
 * 선택일(오늘)의 달과 다르면 — 첫 화면이 텅 빈 달이 되어 "내 기록이 없나?"로
 * 읽힌다. 초기값 계산과 월 이동을 컴포넌트 안에 흩어 두면 그 어긋남을 테스트로
 * 잡을 수 없으므로 여기 모아 둔다.
 *
 * `month`는 `Date`와 같은 0-based(0=1월) — `buildMonthGrid`/`monthLabel`과 동일한 규약.
 * (`lib/month.ts`는 웹과 공유되는 파일이라 건드리지 않고 이 모듈을 옆에 둔다.)
 */
export type MonthView = {
  year: number
  /** 0-based(0=1월) */
  month: number
}

/** 그 날짜가 속한 달. 캘린더 기본 표시 월은 항상 이걸로 정한다. */
export function monthViewOfDate(date: Date): MonthView {
  return { year: date.getFullYear(), month: date.getMonth() }
}

/**
 * 'YYYY-MM-DD' 키가 속한 달.
 * 키는 로컬 타임존 기준(`localDayKey`)이므로 파싱도 문자열에서 바로 한다 —
 * `new Date('2026-08-28')`은 UTC로 해석되어 타임존에 따라 하루가 밀린다.
 */
export function monthViewOfKey(key: string): MonthView {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m - 1 }
}

/** 같은 달인지. */
export function isSameMonthView(a: MonthView, b: MonthView): boolean {
  return a.year === b.year && a.month === b.month
}

/** delta 달만큼 이동(연 경계를 넘어간다). */
export function shiftMonthView(view: MonthView, delta: number): MonthView {
  const total = view.year * 12 + view.month + delta
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

/** 그 날짜 키가 오늘보다 미래인지 — 미래 날짜 셀을 비활성으로 두기 위해. */
export function isFutureDayKey(key: string, now: Date): boolean {
  const [y, m, d] = key.split('-').map(Number)
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return new Date(y, m - 1, d).getTime() > midnight.getTime()
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * 'YYYY-MM-DD' → 'M월 D일 (요일)'.
 * 타임라인이 어느 날 것인지 스스로 말하게 하려고 쓴다 — 캘린더에서 달을 넘기면
 * 선택 표시가 화면 밖으로 나가서, 아래 목록만 보면 무슨 날인지 알 수 없었다.
 */
export function dayKeyLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dow = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${dow})`
}
