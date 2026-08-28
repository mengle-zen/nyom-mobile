import { describe, expect, it } from 'vitest'
import { groupMeta, groupMetaLabel } from './group-meta'

describe('groupMeta', () => {
  it('멤버 수와 오늘 올린 사람 수를 조각으로 나눈다', () => {
    expect(groupMeta({ memberCount: 3, todayPosterCount: 2 })).toEqual({
      members: '3명',
      today: '오늘 2명 올림',
      hasToday: true,
    })
  })

  it('오늘 올린 사람이 없으면 0명 대신 문장으로 말하고 강조하지 않는다', () => {
    expect(groupMeta({ memberCount: 1, todayPosterCount: 0 })).toEqual({
      members: '1명',
      today: '오늘 아직 없어요',
      hasToday: false,
    })
  })

  it('집계가 아직 없으면 null (카드가 뼈대를 그린다)', () => {
    expect(groupMeta(undefined)).toBeNull()
  })
})

describe('groupMetaLabel', () => {
  it('접근성용 한 줄로 합친다', () => {
    expect(groupMetaLabel({ memberCount: 3, todayPosterCount: 2 })).toBe(
      '3명 · 오늘 2명 올림',
    )
  })

  it('집계가 없으면 null', () => {
    expect(groupMetaLabel(undefined)).toBeNull()
  })
})
