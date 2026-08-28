import { describe, expect, it } from 'vitest'
import { buildGroupStats } from './stats'

describe('buildGroupStats', () => {
  it('그룹별 멤버 수를 센다', () => {
    const stats = buildGroupStats(
      ['a', 'b'],
      [
        { group_id: 'a', user_id: 'u1' },
        { group_id: 'a', user_id: 'u2' },
        { group_id: 'b', user_id: 'u1' },
      ],
      [],
    )
    expect(stats.a.memberCount).toBe(2)
    expect(stats.b.memberCount).toBe(1)
  })

  it('같은 사람이 오늘 여러 번 올려도 1명으로 센다', () => {
    const stats = buildGroupStats(
      ['a'],
      [{ group_id: 'a', user_id: 'u1' }],
      [
        { group_id: 'a', user_id: 'u1' },
        { group_id: 'a', user_id: 'u1' },
        { group_id: 'a', user_id: 'u2' },
      ],
    )
    expect(stats.a.todayPosterCount).toBe(2)
  })

  it('행이 없는 그룹도 0으로 채운다', () => {
    const stats = buildGroupStats(['a', 'b'], [], [])
    expect(stats).toEqual({
      a: { memberCount: 0, todayPosterCount: 0 },
      b: { memberCount: 0, todayPosterCount: 0 },
    })
  })

  it('목록에 없는 그룹의 행은 무시한다', () => {
    const stats = buildGroupStats(
      ['a'],
      [{ group_id: 'zzz', user_id: 'u1' }],
      [{ group_id: 'zzz', user_id: 'u1' }],
    )
    expect(stats.a).toEqual({ memberCount: 0, todayPosterCount: 0 })
    expect(Object.keys(stats)).toEqual(['a'])
  })

  it('group_id가 없는 개인 게시물은 세지 않는다', () => {
    const stats = buildGroupStats(
      ['a'],
      [{ group_id: 'a', user_id: 'u1' }],
      [{ group_id: null, user_id: 'u1' }],
    )
    expect(stats.a.todayPosterCount).toBe(0)
  })
})
