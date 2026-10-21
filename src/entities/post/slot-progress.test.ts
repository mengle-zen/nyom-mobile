import { describe, it, expect } from 'vitest'
import { slotProgress, clampSlotIdx, pageIndex } from './slot-progress'
import { MEAL_SLOTS } from './board'

const members = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }]

function post(user_id: string, meal_slot: string | null, created_at = '2026-08-28T09:00:00Z') {
  return { user_id, meal_slot, meal_tag: null as string | null, created_at }
}

function tagged(user_id: string, meal_tag: string, created_at = '2026-08-28T22:00:00Z') {
  return { user_id, meal_slot: null, meal_tag, created_at }
}

describe('slotProgress', () => {
  it('4개 슬롯을 MEAL_SLOTS 순서대로 돌려준다', () => {
    const result = slotProgress(members, [])
    expect(result.map((s) => s.key)).toEqual(MEAL_SLOTS.map((s) => s.key))
    expect(result.map((s) => s.label)).toEqual(['아침', '점심', '저녁', '간식'])
  })

  it('기록이 없으면 전부 0/멤버수', () => {
    expect(slotProgress(members, [])).toMatchObject([
      { key: 'breakfast', label: '아침', filled: 0, total: 3 },
      { key: 'lunch', label: '점심', filled: 0, total: 3 },
      { key: 'dinner', label: '저녁', filled: 0, total: 3 },
      { key: 'snack', label: '간식', filled: 0, total: 3 },
    ])
  })

  it('슬롯별로 올린 멤버 수를 센다', () => {
    const posts = [post('a', 'breakfast'), post('b', 'lunch'), post('c', 'lunch')]
    const byKey = Object.fromEntries(slotProgress(members, posts).map((s) => [s.key, s.filled]))
    expect(byKey).toEqual({ breakfast: 1, lunch: 2, dinner: 0, snack: 0 })
  })

  it('같은 멤버가 한 슬롯에 여러 번 올려도 1로 센다', () => {
    const posts = [
      post('a', 'dinner', '2026-08-28T18:00:00Z'),
      post('a', 'dinner', '2026-08-28T19:00:00Z'),
    ]
    expect(slotProgress(members, posts).find((s) => s.key === 'dinner')?.filled).toBe(1)
  })

  it('그룹에 속하지 않은 사람의 기록·끼니 없는 기록은 무시한다', () => {
    const posts = [post('zzz', 'lunch'), post('a', null)]
    expect(slotProgress(members, posts).every((s) => s.filled === 0)).toBe(true)
  })

  it('멤버가 없으면 total도 0', () => {
    expect(slotProgress([], [post('a', 'lunch')])).toMatchObject([
      { key: 'breakfast', label: '아침', filled: 0, total: 0 },
      { key: 'lunch', label: '점심', filled: 0, total: 0 },
      { key: 'dinner', label: '저녁', filled: 0, total: 0 },
      { key: 'snack', label: '간식', filled: 0, total: 0 },
    ])
  })
})

describe('slotProgress — 태그 페이지', () => {
  it('그날 올라온 태그가 기본 끼니 뒤에 처음 올라온 순서로 붙는다', () => {
    const posts = [
      tagged('a', '술', '2026-08-28T23:00:00Z'),
      tagged('b', '야식', '2026-08-28T22:00:00Z'),
      tagged('c', '술', '2026-08-28T21:30:00Z'),
    ]
    const result = slotProgress(members, posts)
    expect(result.map((s) => s.key)).toEqual([
      'breakfast', 'lunch', 'dinner', 'snack', 'tag:술', 'tag:야식',
    ])
    expect(result.slice(4)).toMatchObject([
      { label: '술', isTag: true, filled: 2, meal: { slot: null, tag: '술' } },
      { label: '야식', isTag: true, filled: 1 },
    ])
    expect(result[3].isTag).toBe(false)
  })

  it('태그 기록은 기본 끼니 칸을 채우지 않는다', () => {
    const result = slotProgress(members, [tagged('a', '야식')])
    expect(result.slice(0, 4).every((s) => s.filled === 0)).toBe(true)
  })
})

describe('pageIndex', () => {
  const pages = slotProgress(members, [tagged('a', '야식')])

  it('키가 있으면 그 자리', () => {
    expect(pageIndex(pages, 'dinner')).toBe(2)
    expect(pageIndex(pages, 'tag:야식')).toBe(4)
  })

  it('그날 없는 태그면 간식으로 — 아침으로 튀지 않는다', () => {
    expect(pageIndex(pages, 'tag:술')).toBe(3)
  })

  it('모르는 키면 첫 끼니', () => {
    expect(pageIndex(pages, 'late_snack')).toBe(0)
  })
})

describe('clampSlotIdx', () => {
  it('범위 안은 그대로', () => {
    expect(clampSlotIdx(0, 4)).toBe(0)
    expect(clampSlotIdx(2, 4)).toBe(2)
    expect(clampSlotIdx(3, 4)).toBe(3)
  })
  it('페이지 수를 따른다', () => {
    expect(clampSlotIdx(5, 6)).toBe(5)
    expect(clampSlotIdx(6, 6)).toBe(5)
  })
  it('양 끝을 넘으면 잘린다', () => {
    expect(clampSlotIdx(-1, 4)).toBe(0)
    expect(clampSlotIdx(-99, 4)).toBe(0)
    expect(clampSlotIdx(4, 4)).toBe(3)
    expect(clampSlotIdx(99, 4)).toBe(3)
  })
})
