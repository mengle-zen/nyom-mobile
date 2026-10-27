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
  it('오늘·과거 날짜를 오프셋으로 바꾼다', () => {
    expect(deeplinkTarget({ date: '2026-08-27' }, NOW, MAX)).toEqual({ dateOffset: 0 })
    expect(deeplinkTarget({ date: '2026-08-25' }, NOW, MAX)).toEqual({ dateOffset: 2 })
    expect(deeplinkTarget({ date: '2026-08-14' }, NOW, MAX)).toEqual({ dateOffset: 13 })
  })

  it('날짜가 없으면 오늘', () => {
    expect(deeplinkTarget({}, NOW, MAX)).toEqual({ dateOffset: 0 })
  })

  it('미래·범위 초과·잘못된 형식은 오늘로 폴백', () => {
    expect(deeplinkTarget({ date: '2026-08-28' }, NOW, MAX)).toEqual({ dateOffset: 0 })
    expect(deeplinkTarget({ date: '2027-01-01' }, NOW, MAX)).toEqual({ dateOffset: 0 })
    expect(deeplinkTarget({ date: '2026-08-13' }, NOW, MAX)).toEqual({ dateOffset: 0 })
    expect(deeplinkTarget({ date: '2020-01-01' }, NOW, MAX)).toEqual({ dateOffset: 0 })
    expect(deeplinkTarget({ date: 'nope' }, NOW, MAX)).toEqual({ dateOffset: 0 })
  })

  it('날짜 경계 — 자정 직후에도 오프셋이 안정적', () => {
    const justAfterMidnight = new Date(2026, 7, 27, 0, 1, 0)
    expect(deeplinkTarget({ date: '2026-08-26' }, justAfterMidnight, MAX).dateOffset).toBe(1)
  })
})
