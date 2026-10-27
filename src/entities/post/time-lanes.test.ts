import { describe, expect, it } from 'vitest'
import { FOLD_HEIGHT, LANE_GAP, laneMembers, postsByMember, timeLanesLayout } from './time-lanes'

const at = (h: number, m: number) => new Date(2026, 9, 27, h, m).toISOString()
const P = 60
const run = (lanes: [string, number, number][][], now: Date | null = null) =>
  timeLanesLayout({ lanes: lanes.map((l) => l.map(([id, h, m]) => ({ id, at: at(h, m) }))), photo: P, now })
const yOf = (r: ReturnType<typeof run>, id: string) => r.items.find((i) => i.postId === id)!.y

describe('timeLanesLayout', () => {
  it('사진이 없으면 빈 결과', () => {
    expect(run([[], []])).toEqual({ height: 0, items: [], marks: [], nowY: null })
  })

  it('한 장이면 맨 위, 높이는 사진 한 변', () => {
    const r = run([[['a', 12, 0]]])
    expect(r.items).toEqual([{ postId: 'a', lane: 0, y: 0 }])
    expect(r.height).toBe(P)
  })

  it('같은 띠에서 겹치면 앞 사진 아래로 민다', () => {
    const r = run([[['a', 12, 20], ['b', 12, 31]]])
    expect(yOf(r, 'a')).toBe(0)
    expect(yOf(r, 'b')).toBe(P + LANE_GAP)
  })

  it('다른 띠는 서로 밀지 않는다', () => {
    const r = run([[['a', 12, 0]], [['b', 12, 10]]])
    expect(yOf(r, 'b')).toBe(20)
  })

  it('1시간 넘게 비면 접힌 줄, 다음 구간은 그 아래', () => {
    const r = run([[['a', 8, 0]], [['b', 10, 0]]])
    expect(r.marks).toContainEqual({ kind: 'fold', y: P + LANE_GAP, from: '08:30', to: '10:00' })
    expect(yOf(r, 'b')).toBe(P + LANE_GAP + FOLD_HEIGHT + LANE_GAP)
  })

  it('딱 1시간 비면 접지 않는다', () => {
    const r = run([[['a', 8, 0]], [['b', 9, 30]]])
    expect(r.marks.some((m) => m.kind === 'fold')).toBe(false)
    expect(yOf(r, 'b')).toBe(90 * 2)
  })

  it('밀려서 길어진 띠 다음 구간은 그 끝보다 아래에서 시작', () => {
    const r = run([[['a', 12, 0], ['b', 12, 5], ['c', 12, 10]], [['d', 13, 0], ['e', 15, 0]]])
    const cBottom = yOf(r, 'c') + P
    expect(yOf(r, 'e')).toBeGreaterThanOrEqual(cBottom + LANE_GAP + FOLD_HEIGHT + LANE_GAP)
  })

  it('띠 안 순서 = 시각 순서, 겹침 없음', () => {
    const r = run([[['a', 9, 0], ['b', 9, 1], ['c', 9, 2], ['d', 14, 0], ['e', 14, 20]]])
    const ys = ['a', 'b', 'c', 'd', 'e'].map((id) => yOf(r, id))
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] + P + LANE_GAP)
  })

  it('구간 안 정시마다 눈금', () => {
    const r = run([[['a', 11, 50], ['b', 12, 31]]])
    expect(r.marks.filter((m) => m.kind === 'tick')).toEqual([
      { kind: 'tick', y: 20, label: '12:00' },
      { kind: 'tick', y: 140, label: '13:00' },
    ])
  })

  it('자정을 넘는 눈금은 없다(23:40 사진의 30분 자리가 24:10까지여도)', () => {
    const r = run([[['a', 23, 40]]])
    expect(r.marks.filter((m) => m.kind === 'tick')).toEqual([])
  })

  it('지금 선 — 구간 안 / 조금 뒤 / 한참 뒤', () => {
    expect(run([[['a', 12, 0]]], new Date(2026, 9, 27, 12, 10)).nowY).toBe(20)
    const soon = run([[['a', 12, 0]]], new Date(2026, 9, 27, 12, 50))
    expect(soon.nowY).toBe(100)
    expect(soon.height).toBeGreaterThanOrEqual(100)
    const late = run([[['a', 12, 0]]], new Date(2026, 9, 27, 15, 0))
    expect(late.marks).toContainEqual({ kind: 'fold', y: P + LANE_GAP, from: '12:30', to: '15:00' })
    expect(late.nowY).toBe(P + LANE_GAP + FOLD_HEIGHT + LANE_GAP)
  })
})

describe('laneMembers', () => {
  it('나를 맨 앞으로, 나머지는 원래 순서', () => {
    const ms = [{ user_id: 'a' }, { user_id: 'me' }, { user_id: 'b' }]
    expect(laneMembers(ms, 'me').map((m) => m.user_id)).toEqual(['me', 'a', 'b'])
  })
})

describe('postsByMember', () => {
  it('그 사람 기록만 시각순', () => {
    const ps = [
      { id: '2', user_id: 'a', recorded_at: at(12, 0) },
      { id: 'x', user_id: 'b', recorded_at: at(9, 0) },
      { id: '1', user_id: 'a', recorded_at: at(8, 0) },
    ]
    expect(postsByMember(ps, 'a').map((p) => p.id)).toEqual(['1', '2'])
  })
})
