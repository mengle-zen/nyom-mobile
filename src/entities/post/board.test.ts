import { describe, it, expect } from 'vitest'
import {
  MEAL_SLOTS,
  slotLabel,
  mealTimeLabel,
  buildSlotBoard,
  boardPages,
  defaultSlotForHour,
  mealOf,
  mealKey,
  mealFromKey,
  sameMeal,
  parseMealTag,
  type Meal,
} from './board'

const lunch: Meal = { slot: 'lunch', tag: null }
const dinner: Meal = { slot: 'dinner', tag: null }
const yasik: Meal = { slot: null, tag: '야식' }

type M = { user_id: string; nickname: string }
type P = {
  id: string
  user_id: string
  meal_slot: string | null
  meal_tag?: string | null
  created_at: string
}

const members: M[] = [
  { user_id: 'u1', nickname: '효린' },
  { user_id: 'u2', nickname: '재빈' },
]

describe('MEAL_SLOTS', () => {
  it('4개 끼니가 순서대로', () => {
    expect(MEAL_SLOTS.map((s) => s.key)).toEqual([
      'breakfast', 'lunch', 'dinner', 'snack',
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
    const board = buildSlotBoard(members, posts, lunch)
    expect(board.filledCount).toBe(1)
    expect(board.tiles).toHaveLength(2)
    expect(board.tiles[0]).toMatchObject({ member: members[0], post: posts[0] })
    expect(board.tiles[1]).toMatchObject({ member: members[1], post: null })
  })

  it('다른 슬롯 게시물은 제외', () => {
    const posts: P[] = [
      { id: 'p1', user_id: 'u1', meal_slot: 'dinner', created_at: '2026-06-09T19:00:00Z' },
    ]
    const board = buildSlotBoard(members, posts, lunch)
    expect(board.filledCount).toBe(0)
    expect(board.tiles.every((t) => t.post === null)).toBe(true)
  })

  it('같은 멤버 같은 슬롯 다중이면 최신 1개 + extraCount', () => {
    const posts: P[] = [
      { id: 'p1', user_id: 'u1', meal_slot: 'lunch', created_at: '2026-06-09T12:00:00Z' },
      { id: 'p2', user_id: 'u1', meal_slot: 'lunch', created_at: '2026-06-09T13:30:00Z' },
    ]
    const board = buildSlotBoard(members, posts, lunch)
    expect(board.tiles[0].post?.id).toBe('p2')      // 최신
    expect(board.tiles[0].extraCount).toBe(1)
  })
})

describe('buildSlotBoard — 태그', () => {
  it('태그 끼니는 같은 태그 기록만 모은다', () => {
    const posts: P[] = [
      { id: 'p1', user_id: 'u1', meal_slot: null, meal_tag: '야식', created_at: '2026-06-09T22:00:00Z' },
      { id: 'p2', user_id: 'u2', meal_slot: null, meal_tag: '술', created_at: '2026-06-09T22:30:00Z' },
      { id: 'p3', user_id: 'u2', meal_slot: 'snack', created_at: '2026-06-09T15:00:00Z' },
    ]
    const board = buildSlotBoard(members, posts, yasik)
    expect(board.filledCount).toBe(1)
    expect(board.tiles[0].post?.id).toBe('p1')
    expect(board.tiles[1].post).toBeNull()
  })
})

describe('boardPages', () => {
  it('태그가 없으면 기본 끼니 넷', () => {
    expect(boardPages([]).map((p) => p.label)).toEqual(['아침', '점심', '저녁', '간식'])
  })

  it('태그는 처음 올라온 시각 순, 같은 태그는 한 번만', () => {
    const posts: P[] = [
      { id: 'a', user_id: 'u1', meal_slot: null, meal_tag: '술', created_at: '2026-06-09T23:00:00Z' },
      { id: 'b', user_id: 'u2', meal_slot: null, meal_tag: '디저트', created_at: '2026-06-09T20:00:00Z' },
      { id: 'c', user_id: 'u2', meal_slot: null, meal_tag: '술', created_at: '2026-06-09T21:00:00Z' },
    ]
    expect(boardPages(posts).slice(4).map((p) => p.key)).toEqual(['tag:디저트', 'tag:술'])
  })
})

describe('끼니 값', () => {
  it('mealOf — 태그가 있으면 태그, 없으면 끼니, 둘 다 모르면 null', () => {
    expect(mealOf({ meal_slot: null, meal_tag: '야식' })).toEqual(yasik)
    expect(mealOf({ meal_slot: 'lunch', meal_tag: null })).toEqual(lunch)
    expect(mealOf({ meal_slot: 'late_snack' })).toBeNull()
    expect(mealOf({ meal_slot: null })).toBeNull()
  })

  it('mealKey ↔ mealFromKey 왕복', () => {
    for (const meal of [lunch, yasik, { slot: null, tag: 'lunch' } as Meal]) {
      expect(mealFromKey(mealKey(meal))).toEqual(meal)
    }
    expect(mealKey(yasik)).toBe('tag:야식')
    expect(mealFromKey('late_snack')).toBeNull()
    expect(mealFromKey(undefined)).toBeNull()
  })

  it('sameMeal — 끼니 키가 같은 이름의 태그와 섞이지 않는다', () => {
    expect(sameMeal(lunch, { slot: 'lunch', tag: null })).toBe(true)
    expect(sameMeal(lunch, { slot: null, tag: 'lunch' })).toBe(false)
    expect(sameMeal(null, null)).toBe(true)
    expect(sameMeal(lunch, null)).toBe(false)
  })
})

describe('parseMealTag', () => {
  it('공백을 다듬는다', () => {
    expect(parseMealTag('  늦은   야식 ')).toEqual({ ok: true, meal: { slot: null, tag: '늦은 야식' } })
  })

  it('기본 끼니 이름이면 그 끼니', () => {
    expect(parseMealTag(' 간식')).toEqual({ ok: true, meal: { slot: 'snack', tag: null } })
  })

  it('비었거나 10자를 넘으면 거절', () => {
    expect(parseMealTag('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(parseMealTag('가나다라마바사아자차').ok).toBe(true)
    expect(parseMealTag('가나다라마바사아자차카')).toEqual({ ok: false, reason: 'too_long' })
  })

  it('글자 수는 코드 포인트로 센다(DB char_length와 같게)', () => {
    expect(parseMealTag('🍜🍜🍜🍜🍜🍜🍜🍜🍜🍜').ok).toBe(true)
  })
})

describe('mealTimeLabel', () => {
  it('끼니 · HH:mm', () => {
    expect(mealTimeLabel(new Date(2026, 5, 9, 12, 34).toISOString(), lunch))
      .toBe('점심 · 12:34')
  })

  it('끼니가 없으면 시각만', () => {
    expect(mealTimeLabel(new Date(2026, 5, 9, 8, 5).toISOString(), null))
      .toBe('08:05')
  })

  it('시각을 못 읽으면 끼니만', () => {
    expect(mealTimeLabel('not-a-date', dinner)).toBe('저녁')
    expect(mealTimeLabel(null, dinner)).toBe('저녁')
  })

  it('둘 다 없으면 빈 문자열', () => {
    expect(mealTimeLabel(null, null)).toBe('')
  })

  it('3열 그리드 칩에 들어갈 만큼 짧다', () => {
    const label = mealTimeLabel(new Date(2026, 5, 9, 23, 59).toISOString(), yasik)
    expect(label).toBe('야식 · 23:59')
    expect(label.length).toBeLessThanOrEqual(12)
  })
})

describe('defaultSlotForHour', () => {
  it('새벽 0~4시는 아침이 아니라 간식이다', () => {
    // 전날에서 이어지는 시간대. 웹앱 초기 구현은 여기를 아침으로 잡았다.
    for (const h of [0, 1, 2, 3, 4]) {
      expect(defaultSlotForHour(h)).toBe('snack')
    }
  })

  it('아침·점심·저녁 경계', () => {
    expect(defaultSlotForHour(5)).toBe('breakfast')
    expect(defaultSlotForHour(10)).toBe('breakfast')
    expect(defaultSlotForHour(11)).toBe('lunch')
    expect(defaultSlotForHour(15)).toBe('lunch')
    expect(defaultSlotForHour(16)).toBe('dinner')
    expect(defaultSlotForHour(20)).toBe('dinner')
    expect(defaultSlotForHour(21)).toBe('snack')
    expect(defaultSlotForHour(23)).toBe('snack')
  })

  it('0~23 전 구간이 유효한 슬롯을 돌려준다', () => {
    const keys = MEAL_SLOTS.map((s) => s.key)
    for (let h = 0; h < 24; h++) {
      expect(keys).toContain(defaultSlotForHour(h))
    }
  })
})
