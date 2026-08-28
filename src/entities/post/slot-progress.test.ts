import { describe, it, expect } from 'vitest'
import { slotProgress, clampSlotIdx } from './slot-progress'
import { MEAL_SLOTS } from './board'

const members = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }]

function post(user_id: string, meal_slot: string | null, created_at = '2026-08-28T09:00:00Z') {
  return { user_id, meal_slot, created_at }
}

describe('slotProgress', () => {
  it('4개 슬롯을 MEAL_SLOTS 순서대로 돌려준다', () => {
    const result = slotProgress(members, [])
    expect(result.map((s) => s.key)).toEqual(MEAL_SLOTS.map((s) => s.key))
    expect(result.map((s) => s.label)).toEqual(['아침', '점심', '저녁', '야식'])
  })

  it('기록이 없으면 전부 0/멤버수', () => {
    expect(slotProgress(members, [])).toEqual([
      { key: 'breakfast', label: '아침', filled: 0, total: 3 },
      { key: 'lunch', label: '점심', filled: 0, total: 3 },
      { key: 'dinner', label: '저녁', filled: 0, total: 3 },
      { key: 'late_snack', label: '야식', filled: 0, total: 3 },
    ])
  })

  it('슬롯별로 올린 멤버 수를 센다', () => {
    const posts = [post('a', 'breakfast'), post('b', 'lunch'), post('c', 'lunch')]
    const byKey = Object.fromEntries(slotProgress(members, posts).map((s) => [s.key, s.filled]))
    expect(byKey).toEqual({ breakfast: 1, lunch: 2, dinner: 0, late_snack: 0 })
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
    expect(slotProgress([], [post('a', 'lunch')])).toEqual([
      { key: 'breakfast', label: '아침', filled: 0, total: 0 },
      { key: 'lunch', label: '점심', filled: 0, total: 0 },
      { key: 'dinner', label: '저녁', filled: 0, total: 0 },
      { key: 'late_snack', label: '야식', filled: 0, total: 0 },
    ])
  })
})

describe('clampSlotIdx', () => {
  it('범위 안은 그대로', () => {
    expect(clampSlotIdx(0)).toBe(0)
    expect(clampSlotIdx(2)).toBe(2)
    expect(clampSlotIdx(3)).toBe(3)
  })
  it('양 끝을 넘으면 잘린다', () => {
    expect(clampSlotIdx(-1)).toBe(0)
    expect(clampSlotIdx(-99)).toBe(0)
    expect(clampSlotIdx(4)).toBe(3)
    expect(clampSlotIdx(99)).toBe(3)
  })
})
