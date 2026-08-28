import { describe, it, expect } from 'vitest'
import {
  MEAL_SLOTS,
  slotLabel,
  mealTimeLabel,
  buildSlotBoard,
  defaultSlotForHour,
} from './board'

type M = { user_id: string; nickname: string }
type P = {
  id: string
  user_id: string
  meal_slot: string | null
  created_at: string
}

const members: M[] = [
  { user_id: 'u1', nickname: '효린' },
  { user_id: 'u2', nickname: '재빈' },
]

describe('MEAL_SLOTS', () => {
  it('4개 끼니가 순서대로', () => {
    expect(MEAL_SLOTS.map((s) => s.key)).toEqual([
      'breakfast', 'lunch', 'dinner', 'late_snack',
    ])
  })
})

describe('slotLabel', () => {
  it('한글 라벨', () => {
    expect(slotLabel('lunch')).toBe('점심')
  })
})

describe('buildSlotBoard', () => {
  it('멤버별 타일을 만들고 게시물 유무로 filled/empty 구분', () => {
    const posts: P[] = [
      { id: 'p1', user_id: 'u1', meal_slot: 'lunch', created_at: '2026-06-09T12:00:00Z' },
    ]
    const board = buildSlotBoard(members, posts, 'lunch')
    expect(board.filledCount).toBe(1)
    expect(board.tiles).toHaveLength(2)
    expect(board.tiles[0]).toMatchObject({ member: members[0], post: posts[0] })
    expect(board.tiles[1]).toMatchObject({ member: members[1], post: null })
  })

  it('다른 슬롯 게시물은 제외', () => {
    const posts: P[] = [
      { id: 'p1', user_id: 'u1', meal_slot: 'dinner', created_at: '2026-06-09T19:00:00Z' },
    ]
    const board = buildSlotBoard(members, posts, 'lunch')
    expect(board.filledCount).toBe(0)
    expect(board.tiles.every((t) => t.post === null)).toBe(true)
  })

  it('같은 멤버 같은 슬롯 다중이면 최신 1개 + extraCount', () => {
    const posts: P[] = [
      { id: 'p1', user_id: 'u1', meal_slot: 'lunch', created_at: '2026-06-09T12:00:00Z' },
      { id: 'p2', user_id: 'u1', meal_slot: 'lunch', created_at: '2026-06-09T13:30:00Z' },
    ]
    const board = buildSlotBoard(members, posts, 'lunch')
    expect(board.tiles[0].post?.id).toBe('p2')      // 최신
    expect(board.tiles[0].extraCount).toBe(1)
  })
})

describe('mealTimeLabel', () => {
  it('끼니 · HH:mm', () => {
    expect(mealTimeLabel(new Date(2026, 5, 9, 12, 34).toISOString(), 'lunch'))
      .toBe('점심 · 12:34')
  })

  it('끼니가 없으면 시각만', () => {
    expect(mealTimeLabel(new Date(2026, 5, 9, 8, 5).toISOString(), null))
      .toBe('08:05')
  })

  it('시각을 못 읽으면 끼니만', () => {
    expect(mealTimeLabel('not-a-date', 'dinner')).toBe('저녁')
    expect(mealTimeLabel(null, 'dinner')).toBe('저녁')
  })

  it('둘 다 없으면 빈 문자열', () => {
    expect(mealTimeLabel(null, null)).toBe('')
  })

  it('3열 그리드 칩에 들어갈 만큼 짧다', () => {
    const label = mealTimeLabel(new Date(2026, 5, 9, 23, 59).toISOString(), 'late_snack')
    expect(label).toBe('야식 · 23:59')
    expect(label.length).toBeLessThanOrEqual(12)
  })
})

describe('defaultSlotForHour', () => {
  it('새벽 0~4시는 아침이 아니라 야식이다', () => {
    // 전날에서 이어지는 시간대. 웹앱 초기 구현은 여기를 아침으로 잡았다.
    for (const h of [0, 1, 2, 3, 4]) {
      expect(defaultSlotForHour(h)).toBe('late_snack')
    }
  })

  it('아침·점심·저녁 경계', () => {
    expect(defaultSlotForHour(5)).toBe('breakfast')
    expect(defaultSlotForHour(10)).toBe('breakfast')
    expect(defaultSlotForHour(11)).toBe('lunch')
    expect(defaultSlotForHour(15)).toBe('lunch')
    expect(defaultSlotForHour(16)).toBe('dinner')
    expect(defaultSlotForHour(20)).toBe('dinner')
    expect(defaultSlotForHour(21)).toBe('late_snack')
    expect(defaultSlotForHour(23)).toBe('late_snack')
  })

  it('0~23 전 구간이 유효한 슬롯을 돌려준다', () => {
    const keys = MEAL_SLOTS.map((s) => s.key)
    for (let h = 0; h < 24; h++) {
      expect(keys).toContain(defaultSlotForHour(h))
    }
  })
})
