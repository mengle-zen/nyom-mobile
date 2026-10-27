import { describe, expect, it } from 'vitest'
import { MEAL_TAG_MAX, parseMealTag, postTimeLabel } from './meal-tag'

describe('parseMealTag', () => {
  it('공백을 다듬는다', () => {
    expect(parseMealTag('  늦은   야식 ')).toEqual({ ok: true, tag: '늦은 야식' })
  })
  it('예전 기본 끼니 이름도 그냥 태그', () => {
    expect(parseMealTag('점심')).toEqual({ ok: true, tag: '점심' })
  })
  it('비었거나 10자를 넘으면 거절', () => {
    expect(parseMealTag('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(parseMealTag('가'.repeat(MEAL_TAG_MAX)).ok).toBe(true)
    expect(parseMealTag('가'.repeat(MEAL_TAG_MAX + 1))).toEqual({ ok: false, reason: 'too_long' })
  })
  it('글자 수는 코드 포인트(DB char_length와 같게)', () => {
    expect(parseMealTag('🍜'.repeat(10)).ok).toBe(true)
  })
})

describe('postTimeLabel', () => {
  const at = new Date(2026, 9, 27, 23, 40).toISOString()
  it('태그가 없으면 시각만', () => expect(postTimeLabel(at, null)).toBe('23:40'))
  it('태그 · 시각', () => expect(postTimeLabel(at, '야식')).toBe('야식 · 23:40'))
  it('시각을 못 읽으면 태그만, 둘 다 없으면 빈 문자열', () => {
    expect(postTimeLabel('nope', '야식')).toBe('야식')
    expect(postTimeLabel(null, null)).toBe('')
  })
})
