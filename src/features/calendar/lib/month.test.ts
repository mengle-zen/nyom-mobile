import { describe, it, expect } from 'vitest'
import { buildMonthGrid, monthLabel, isMonthAfter } from './month'

describe('buildMonthGrid', () => {
  it('항상 42칸(6주)', () => {
    expect(buildMonthGrid(2026, 5)).toHaveLength(42)
  })

  it('첫 칸은 1일이 속한 주의 일요일', () => {
    // 2026-06-01은 월요일 → 그리드 첫 칸은 5월 31일(일)
    const grid = buildMonthGrid(2026, 5)
    expect(grid[0].key).toBe('2026-05-31')
    expect(grid[0].inMonth).toBe(false)
  })

  it('해당 월 1일은 inMonth', () => {
    const grid = buildMonthGrid(2026, 5)
    const first = grid.find((c) => c.key === '2026-06-01')
    expect(first?.inMonth).toBe(true)
  })

  it('말일 다음 칸은 inMonth=false', () => {
    // 2026년 6월 말일 30일 → 7월 1일은 넘침 칸
    const grid = buildMonthGrid(2026, 5)
    const overflow = grid.find((c) => c.key === '2026-07-01')
    expect(overflow?.inMonth).toBe(false)
  })
})

describe('monthLabel', () => {
  it('YYYY년 M월', () => {
    expect(monthLabel(2026, 0)).toBe('2026년 1월')
    expect(monthLabel(2026, 11)).toBe('2026년 12월')
  })
})

describe('isMonthAfter', () => {
  it('같은 해 다음 달 → true', () => {
    expect(isMonthAfter(2026, 7, 2026, 6)).toBe(true)
  })
  it('같은 달 → false', () => {
    expect(isMonthAfter(2026, 6, 2026, 6)).toBe(false)
  })
  it('이전 해 → false', () => {
    expect(isMonthAfter(2025, 11, 2026, 0)).toBe(false)
  })
})
