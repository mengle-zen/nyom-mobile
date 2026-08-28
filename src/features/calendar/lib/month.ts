import { localDayKey } from '@/entities/post'

export type MonthCell = {
  date: Date
  /** 로컬 'YYYY-MM-DD' 키 */
  key: string
  /** 보고 있는 달에 속하는 날인지(앞뒤 넘침 칸 구분) */
  inMonth: boolean
}

/**
 * 월 캘린더 6주(42칸) 그리드를 만든다.
 * 그리드 첫 칸은 해당 월 1일이 속한 주의 일요일. 레이아웃 흔들림 방지를 위해 항상 42칸.
 * month는 0-based(0=1월).
 */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const firstDow = new Date(year, month, 1).getDay() // 0=일
  const gridStart = new Date(year, month, 1 - firstDow)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    )
    return { date: d, key: localDayKey(d), inMonth: d.getMonth() === month }
  })
}

/** 월 라벨: 'YYYY년 M월' */
export function monthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`
}

/** a가 b보다 이후 달인지(달 단위 비교) — 미래 달 이동 제한용. */
export function isMonthAfter(
  aYear: number, aMonth: number,
  bYear: number, bMonth: number,
): boolean {
  return aYear > bYear || (aYear === bYear && aMonth > bMonth)
}
