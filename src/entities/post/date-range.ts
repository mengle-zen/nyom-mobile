/** 날짜 오프셋(0=오늘)과 기준 시각으로 하루의 [start, end) 범위를 계산한다. */
export function dayRangeFromOffset(
  offset: number,
  now: Date,
): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - offset)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

/** 로컬 타임존 기준 'YYYY-MM-DD' 키. DayPicker의 셀 키 포맷과 동일해야 한다. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 오프셋(0=오늘, N=N일 전) → 해당 날짜(로컬 자정). */
export function dateFromOffset(offset: number, now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offset)
  return d
}

/** 날짜 → 오프셋(오늘=0, 어제=1 …). 미래면 음수. 로컬 자정 기준 일수 차이. */
export function offsetFromDate(date: Date, now: Date): number {
  const a = new Date(now)
  a.setHours(0, 0, 0, 0)
  const b = new Date(date)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

/** Date → 'HH:mm' (로컬). 업로드 시각 컨트롤 기본값·max용. */
export function hhmmFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * 오늘 날짜 + 'HH:mm'로 섭취 시각(ISO)을 만든다.
 * now-only 원칙: 날짜는 오늘 고정, 미래 시각은 현재 시각으로 클램프.
 */
export function recordedAtFromTime(now: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return (d.getTime() > now.getTime() ? now : d).toISOString()
}

/**
 * 사후 편집용 — 기록된 날짜는 그대로 두고 'HH:mm'만 갈아끼운 ISO를 만든다.
 * `recordedAtFromTime`(업로드=오늘 고정)과 달리 기준 날짜가 과거일 수 있다.
 * now-only 원칙: 결과가 미래면 현재 시각으로 클램프(기록일이 오늘일 때만 발생).
 * 잘못된 'HH:mm'이면 원래 시각을 그대로 돌려준다.
 */
export function recordedAtOnSameDay(
  originalIso: string,
  hhmm: string,
  now: Date,
): string {
  const base = new Date(originalIso)
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return base.toISOString()

  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return (d.getTime() > now.getTime() ? now : d).toISOString()
}

/**
 * 사후 편집 시각 입력의 max — 기록일이 오늘이면 지금까지, 과거면 그 날 끝까지.
 * (날짜 백필은 허용하지 않으므로 날짜 자체는 바뀌지 않는다)
 */
export function maxTimeForRecordedDay(originalIso: string, now: Date): string {
  const base = new Date(originalIso)
  return localDayKey(base) === localDayKey(now) ? hhmmFromDate(now) : '23:59'
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 상단 날짜 칩 라벨. 0=오늘, 1=어제, 그 외는 'M월 D일 (요일)'. */
export function dateLabel(offset: number, now: Date): string {
  if (offset === 0) return '오늘'
  if (offset === 1) return '어제'
  const d = new Date(now)
  d.setDate(d.getDate() - offset)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}
