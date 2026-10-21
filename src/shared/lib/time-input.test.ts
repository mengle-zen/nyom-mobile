import { describe, expect, it } from 'vitest'
import { clampTime, formatHHmm, parseHHmm, timeFromParts } from './time-input'

describe('parseHHmm', () => {
  it('정상 형식을 분으로 바꾼다', () => {
    expect(parseHHmm('00:00')).toBe(0)
    expect(parseHHmm('12:34')).toBe(754)
    expect(parseHHmm('23:59')).toBe(1439)
  })

  it('한 자리 시도 허용한다', () => {
    expect(parseHHmm('9:05')).toBe(545)
  })

  it('형식·범위가 틀리면 null', () => {
    expect(parseHHmm('')).toBeNull()
    expect(parseHHmm('12:3')).toBeNull()
    expect(parseHHmm('24:00')).toBeNull()
    expect(parseHHmm('12:60')).toBeNull()
    expect(parseHHmm('abc')).toBeNull()
  })
})

describe('formatHHmm', () => {
  it('두 자리로 채운다', () => {
    expect(formatHHmm(0)).toBe('00:00')
    expect(formatHHmm(545)).toBe('09:05')
    expect(formatHHmm(1439)).toBe('23:59')
  })

  it('하루 범위를 벗어나면 자른다', () => {
    expect(formatHHmm(-30)).toBe('00:00')
    expect(formatHHmm(1500)).toBe('23:59')
  })
})

describe('clampTime', () => {
  it('max 이하면 그대로', () => {
    expect(clampTime('12:00', '18:30')).toBe('12:00')
  })

  it('max를 넘으면 max로 (now-only 원칙)', () => {
    expect(clampTime('23:00', '18:30')).toBe('18:30')
  })

  it('max와 같으면 그대로', () => {
    expect(clampTime('18:30', '18:30')).toBe('18:30')
  })

  it('깨진 입력은 max로 되돌린다', () => {
    expect(clampTime('??:??', '18:30')).toBe('18:30')
  })
})

describe('timeFromParts', () => {
  it('두 칸을 HH:mm으로 — 한 자리는 0을 채운다', () => {
    expect(timeFromParts('12', '30', '23:59')).toEqual({ ok: true, value: '12:30' })
    expect(timeFromParts('9', '5', '23:59')).toEqual({ ok: true, value: '09:05' })
    expect(timeFromParts('00', '00', '23:59')).toEqual({ ok: true, value: '00:00' })
  })

  it('비었거나 숫자가 아니면 incomplete', () => {
    expect(timeFromParts('', '30', '23:59')).toEqual({ ok: false, reason: 'incomplete' })
    expect(timeFromParts('12', '', '23:59')).toEqual({ ok: false, reason: 'incomplete' })
    expect(timeFromParts('1a', '30', '23:59')).toEqual({ ok: false, reason: 'incomplete' })
  })

  it('범위를 넘으면 어느 칸인지 알려 준다', () => {
    expect(timeFromParts('24', '00', '23:59')).toEqual({ ok: false, reason: 'hour' })
    expect(timeFromParts('12', '60', '23:59')).toEqual({ ok: false, reason: 'minute' })
  })

  it('max보다 늦으면 future, max와 같으면 통과', () => {
    expect(timeFromParts('11', '41', '11:40')).toEqual({ ok: false, reason: 'future' })
    expect(timeFromParts('11', '40', '11:40')).toEqual({ ok: true, value: '11:40' })
  })
})
