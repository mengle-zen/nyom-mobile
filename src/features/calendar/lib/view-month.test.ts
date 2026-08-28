import { describe, it, expect } from 'vitest'
import { localDayKey } from '@/entities/post/date-range'
import { buildMonthGrid, monthLabel } from './month'
import {
  dayKeyLabel,
  isFutureDayKey,
  isSameMonthView,
  monthViewOfDate,
  monthViewOfKey,
  shiftMonthView,
} from './view-month'

describe('monthViewOfDate', () => {
  it('그 날이 속한 달(0-based)', () => {
    expect(monthViewOfDate(new Date(2026, 7, 28))).toEqual({ year: 2026, month: 7 })
  })

  it('월 초·말에도 그 달', () => {
    expect(monthViewOfDate(new Date(2026, 7, 1))).toEqual({ year: 2026, month: 7 })
    expect(monthViewOfDate(new Date(2026, 7, 31))).toEqual({ year: 2026, month: 7 })
  })
})

describe('monthViewOfKey', () => {
  it("'YYYY-MM-DD' → 0-based 달", () => {
    expect(monthViewOfKey('2026-08-28')).toEqual({ year: 2026, month: 7 })
    expect(monthViewOfKey('2026-01-01')).toEqual({ year: 2026, month: 0 })
    expect(monthViewOfKey('2026-12-31')).toEqual({ year: 2026, month: 11 })
  })
})

/**
 * 회귀: 돌아보기를 열었을 때 표시 월이 선택일(오늘)의 달과 어긋나면
 * 첫 화면이 기록 하나 없는 빈 달이 된다.
 */
describe('기본 표시 월은 선택일의 달과 같다', () => {
  it('2026-08-28에 열면 2026년 8월', () => {
    const today = new Date(2026, 7, 28, 22, 4)
    const view = monthViewOfDate(today)
    expect(monthLabel(view.year, view.month)).toBe('2026년 8월')
  })

  it('오늘 키에서 되짚어도 같은 달 — 표시 월과 선택일이 어긋나지 않는다', () => {
    for (const today of [
      new Date(2026, 7, 28),
      new Date(2026, 0, 1),
      new Date(2026, 11, 31),
      new Date(2026, 6, 31),
    ]) {
      expect(monthViewOfKey(localDayKey(today))).toEqual(monthViewOfDate(today))
    }
  })

  it('그 달 그리드에 오늘과 최근 기록일이 inMonth로 들어 있다(점이 보인다)', () => {
    const today = new Date(2026, 7, 28)
    const view = monthViewOfDate(today)
    const grid = buildMonthGrid(view.year, view.month)
    const inMonthKeys = new Set(grid.filter((c) => c.inMonth).map((c) => c.key))

    for (const key of ['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28']) {
      expect(inMonthKeys.has(key)).toBe(true)
    }
    expect(inMonthKeys.has(localDayKey(today))).toBe(true)
  })

  it('한 달 전 그리드에는 그 기록일들이 없다 — 빈 달을 첫 화면으로 두면 안 되는 이유', () => {
    const prev = shiftMonthView(monthViewOfDate(new Date(2026, 7, 28)), -1)
    const inMonthKeys = new Set(
      buildMonthGrid(prev.year, prev.month)
        .filter((c) => c.inMonth)
        .map((c) => c.key),
    )
    expect(monthLabel(prev.year, prev.month)).toBe('2026년 7월')
    for (const key of ['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28']) {
      expect(inMonthKeys.has(key)).toBe(false)
    }
  })
})

describe('shiftMonthView', () => {
  it('앞뒤 한 달', () => {
    expect(shiftMonthView({ year: 2026, month: 7 }, -1)).toEqual({
      year: 2026,
      month: 6,
    })
    expect(shiftMonthView({ year: 2026, month: 7 }, 1)).toEqual({
      year: 2026,
      month: 8,
    })
  })

  it('연 경계를 넘는다', () => {
    expect(shiftMonthView({ year: 2026, month: 0 }, -1)).toEqual({
      year: 2025,
      month: 11,
    })
    expect(shiftMonthView({ year: 2026, month: 11 }, 1)).toEqual({
      year: 2027,
      month: 0,
    })
  })

  it('여러 달 이동', () => {
    expect(shiftMonthView({ year: 2026, month: 1 }, -14)).toEqual({
      year: 2024,
      month: 11,
    })
  })

  it('0 이동은 그대로', () => {
    expect(shiftMonthView({ year: 2026, month: 7 }, 0)).toEqual({
      year: 2026,
      month: 7,
    })
  })
})

describe('isSameMonthView', () => {
  it('같은 해·달만 true', () => {
    expect(isSameMonthView({ year: 2026, month: 7 }, { year: 2026, month: 7 })).toBe(true)
    expect(isSameMonthView({ year: 2026, month: 7 }, { year: 2026, month: 6 })).toBe(false)
    expect(isSameMonthView({ year: 2025, month: 7 }, { year: 2026, month: 7 })).toBe(false)
  })
})

describe('isFutureDayKey', () => {
  const now = new Date(2026, 7, 28, 22, 4)

  it('오늘은 미래가 아니다(시각이 남아 있어도)', () => {
    expect(isFutureDayKey('2026-08-28', now)).toBe(false)
  })

  it('내일부터 미래', () => {
    expect(isFutureDayKey('2026-08-29', now)).toBe(true)
    expect(isFutureDayKey('2026-09-01', now)).toBe(true)
  })

  it('과거는 미래가 아니다', () => {
    expect(isFutureDayKey('2026-08-27', now)).toBe(false)
    expect(isFutureDayKey('2025-12-31', now)).toBe(false)
  })
})

describe('dayKeyLabel', () => {
  it("'M월 D일 (요일)'", () => {
    // 2026-08-28은 금요일
    expect(dayKeyLabel('2026-08-28')).toBe('8월 28일 (금)')
    // 2026-08-30은 일요일
    expect(dayKeyLabel('2026-08-30')).toBe('8월 30일 (일)')
  })

  it('한 자리 월·일에 0을 붙이지 않는다', () => {
    expect(dayKeyLabel('2026-01-05')).toBe('1월 5일 (월)')
  })
})
