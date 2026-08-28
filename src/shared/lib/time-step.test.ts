import { describe, expect, it } from 'vitest'
import { canStep, clampTime, formatHHmm, parseHHmm, stepTime } from './time-step'

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

describe('stepTime', () => {
  it('분을 더한다', () => {
    expect(stepTime('12:00', 5, '23:59')).toBe('12:05')
    expect(stepTime('12:00', -5, '23:59')).toBe('11:55')
  })

  it('시간 단위 스텝', () => {
    expect(stepTime('12:34', 60, '23:59')).toBe('13:34')
    expect(stepTime('12:34', -60, '23:59')).toBe('11:34')
  })

  it('max를 넘지 않는다', () => {
    expect(stepTime('18:28', 5, '18:30')).toBe('18:30')
    expect(stepTime('18:30', 60, '18:30')).toBe('18:30')
  })

  it('자정 아래로 내려가지 않는다 — 날짜가 바뀌면 RPC가 거절한다', () => {
    expect(stepTime('00:02', -5, '23:59')).toBe('00:00')
    expect(stepTime('00:00', -60, '23:59')).toBe('00:00')
  })

  it('23:59에서 더해도 다음 날로 넘어가지 않는다', () => {
    expect(stepTime('23:59', 5, '23:59')).toBe('23:59')
  })
})

describe('canStep', () => {
  it('값이 바뀌면 true', () => {
    expect(canStep('12:00', 5, '23:59')).toBe(true)
  })

  it('경계에서 눌러도 안 바뀌면 false', () => {
    expect(canStep('18:30', 5, '18:30')).toBe(false)
    expect(canStep('00:00', -5, '23:59')).toBe(false)
  })
})
