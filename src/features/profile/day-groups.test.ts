import { describe, expect, it } from 'vitest'

import { groupByDay, longDayLabel, shortDayLabel } from './day-groups'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()
const post = (id: string, d: number, h: number) => ({ id, recorded_at: at(d, h) })

describe('groupByDay', () => {
  it('먹은 날로 묶고 최근 날부터, 하루 안은 이른 끼니부터', () => {
    const r = groupByDay([post('dinner19', 19, 19), post('lunch18', 18, 12), post('breakfast19', 19, 8)])
    expect(r.map((g) => [g.key, g.posts.map((p) => p.id)])).toEqual([
      ['2026-11-19', ['breakfast19', 'dinner19']],
      ['2026-11-18', ['lunch18']],
    ])
  })

  it('자정 근처도 로컬 날짜로 가른다', () => {
    const r = groupByDay([post('late', 18, 23), post('early', 19, 0)])
    expect(r.map((g) => g.key)).toEqual(['2026-11-19', '2026-11-18'])
  })

  it('기록이 없으면 빈 목록', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('day labels', () => {
  it('칸 띠는 짧게, 상세는 길게', () => {
    expect(shortDayLabel('2026-11-09')).toBe('11.09 (월)')
    expect(longDayLabel('2026-11-19')).toBe('11월 19일 (목)')
  })
})
