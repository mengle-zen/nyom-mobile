import { describe, it, expect } from 'vitest'
import { dateHeading } from './date-heading'

// 2026-08-28은 금요일
const NOW = new Date('2026-08-28T10:00:00')

describe('dateHeading', () => {
  it('오늘은 캡션이 없다 — 더 붙일 말이 없다', () => {
    expect(dateHeading(0, NOW)).toEqual({ primary: '오늘', secondary: null })
  })

  it('어제·그저께는 상대어가 주 라벨, 날짜가 캡션', () => {
    expect(dateHeading(1, NOW)).toEqual({
      primary: '어제',
      secondary: '8월 27일 (목)',
    })
    expect(dateHeading(2, NOW)).toEqual({
      primary: '그저께',
      secondary: '8월 26일 (수)',
    })
  })

  it('3~6일 전은 「N일 전」', () => {
    expect(dateHeading(3, NOW).primary).toBe('3일 전')
    expect(dateHeading(6, NOW).primary).toBe('6일 전')
    expect(dateHeading(6, NOW).secondary).toBe('8월 22일 (토)')
  })

  it('7일 전부터는 절대날짜가 주 라벨, 「N일 전」이 캡션', () => {
    expect(dateHeading(7, NOW)).toEqual({
      primary: '8월 21일 (금)',
      secondary: '7일 전',
    })
    expect(dateHeading(13, NOW)).toEqual({
      primary: '8월 15일 (토)',
      secondary: '13일 전',
    })
  })

  it('달·해 경계를 넘어도 요일이 맞는다', () => {
    const newYear = new Date('2027-01-02T09:00:00') // 토요일
    expect(dateHeading(3, newYear).secondary).toBe('12월 30일 (수)')
  })

  it('미래(음수)는 날짜만 — 보드에서는 클램프되어 오지 않는다', () => {
    expect(dateHeading(-1, NOW)).toEqual({
      primary: '8월 29일 (토)',
      secondary: null,
    })
  })

  it('기준 시각의 시·분에 흔들리지 않는다', () => {
    const early = new Date('2026-08-28T00:05:00')
    const late = new Date('2026-08-28T23:55:00')
    expect(dateHeading(5, early)).toEqual(dateHeading(5, late))
  })
})
