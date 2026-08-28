import { describe, it, expect } from 'vitest'
import { parseLocalDate, deeplinkTarget } from './deeplink'

const NOW = new Date(2026, 7, 27, 15, 0, 0) // 2026-08-27 15:00 로컬
const MAX = 13

describe('parseLocalDate', () => {
  it('YYYY-MM-DD를 로컬 자정으로 파싱한다', () => {
    const d = parseLocalDate('2026-08-27')
    expect(d).not.toBeNull()
    expect([d!.getFullYear(), d!.getMonth(), d!.getDate()]).toEqual([2026, 7, 27])
    expect([d!.getHours(), d!.getMinutes()]).toEqual([0, 0])
  })

  it('빈 값은 null', () => {
    expect(parseLocalDate(undefined)).toBeNull()
    expect(parseLocalDate(null)).toBeNull()
    expect(parseLocalDate('')).toBeNull()
  })

  it('형식이 틀리면 null', () => {
    expect(parseLocalDate('2026-8-27')).toBeNull()
    expect(parseLocalDate('26-08-27')).toBeNull()
    expect(parseLocalDate('2026/08/27')).toBeNull()
    expect(parseLocalDate('2026-08-27T00:00:00Z')).toBeNull()
    expect(parseLocalDate('오늘')).toBeNull()
  })

  it('실재하지 않는 날짜는 null (롤오버 방지)', () => {
    expect(parseLocalDate('2026-02-31')).toBeNull()
    expect(parseLocalDate('2026-13-01')).toBeNull()
    expect(parseLocalDate('2026-00-10')).toBeNull()
    expect(parseLocalDate('2026-04-31')).toBeNull()
  })

  it('윤년 2월 29일은 유효', () => {
    expect(parseLocalDate('2024-02-29')).not.toBeNull()
    expect(parseLocalDate('2026-02-29')).toBeNull()
  })
})

describe('deeplinkTarget', () => {
  it('오늘 날짜 + 끼니를 오프셋/인덱스로 바꾼다', () => {
    expect(deeplinkTarget({ date: '2026-08-27', slot: 'lunch' }, NOW, MAX)).toEqual({
      dateOffset: 0,
      slotIdx: 1,
    })
  })

  it('과거 날짜는 오프셋으로 환산한다', () => {
    expect(deeplinkTarget({ date: '2026-08-25', slot: 'dinner' }, NOW, MAX)).toEqual({
      dateOffset: 2,
      slotIdx: 2,
    })
    expect(deeplinkTarget({ date: '2026-08-14', slot: 'late_snack' }, NOW, MAX)).toEqual({
      dateOffset: 13,
      slotIdx: 3,
    })
  })

  it('파라미터가 없으면 오늘/첫 끼니', () => {
    expect(deeplinkTarget({}, NOW, MAX)).toEqual({ dateOffset: 0, slotIdx: 0 })
  })

  it('미래 날짜는 무시하고 오늘로 폴백', () => {
    expect(deeplinkTarget({ date: '2026-08-28', slot: 'lunch' }, NOW, MAX)).toEqual({
      dateOffset: 0,
      slotIdx: 1,
    })
    expect(deeplinkTarget({ date: '2027-01-01' }, NOW, MAX)).toEqual({
      dateOffset: 0,
      slotIdx: 0,
    })
  })

  it('MAX_OFFSET을 넘는 과거는 무시하고 오늘로 폴백', () => {
    expect(deeplinkTarget({ date: '2026-08-13' }, NOW, MAX)).toEqual({
      dateOffset: 0,
      slotIdx: 0,
    })
    expect(deeplinkTarget({ date: '2020-01-01' }, NOW, MAX)).toEqual({
      dateOffset: 0,
      slotIdx: 0,
    })
  })

  it('잘못된 날짜 형식은 오늘로 폴백 (슬롯은 유지)', () => {
    expect(deeplinkTarget({ date: 'nope', slot: 'dinner' }, NOW, MAX)).toEqual({
      dateOffset: 0,
      slotIdx: 2,
    })
  })

  it('알 수 없는 슬롯은 첫 끼니 (날짜는 유지)', () => {
    expect(deeplinkTarget({ date: '2026-08-25', slot: 'brunch' }, NOW, MAX)).toEqual({
      dateOffset: 2,
      slotIdx: 0,
    })
    expect(deeplinkTarget({ date: '2026-08-25', slot: '' }, NOW, MAX)).toEqual({
      dateOffset: 2,
      slotIdx: 0,
    })
  })

  it('모든 끼니 키가 MEAL_SLOTS 순서대로 매핑된다', () => {
    const keys = ['breakfast', 'lunch', 'dinner', 'late_snack']
    keys.forEach((slot, i) => {
      expect(deeplinkTarget({ slot }, NOW, MAX).slotIdx).toBe(i)
    })
  })

  it('날짜 경계 — 자정 직후에도 오프셋이 안정적', () => {
    const justAfterMidnight = new Date(2026, 7, 27, 0, 1, 0)
    expect(deeplinkTarget({ date: '2026-08-26' }, justAfterMidnight, MAX).dateOffset).toBe(1)
  })
})
