import { describe, it, expect } from 'vitest'
import { nextReactions, type ReactionLite } from './toggle'

const me = 'u1'

describe('nextReactions (1인 1리액션)', () => {
  it('없을 때 추가', () => {
    const r = nextReactions([], me, '❤️')
    expect(r).toEqual([{ user_id: 'u1', emoji: '❤️' }])
  })

  it('같은 이모지 다시 누르면 해제', () => {
    const start: ReactionLite[] = [{ user_id: 'u1', emoji: '❤️' }]
    expect(nextReactions(start, me, '❤️')).toEqual([])
  })

  it('다른 이모지 누르면 교체(내 것 1개 유지)', () => {
    const start: ReactionLite[] = [{ user_id: 'u1', emoji: '❤️' }]
    const r = nextReactions(start, me, '🔥')
    expect(r).toEqual([{ user_id: 'u1', emoji: '🔥' }])
  })

  it('남의 리액션은 보존', () => {
    const start: ReactionLite[] = [{ user_id: 'u2', emoji: '❤️' }]
    const r = nextReactions(start, me, '🔥')
    expect(r).toContainEqual({ user_id: 'u2', emoji: '❤️' })
    expect(r).toContainEqual({ user_id: 'u1', emoji: '🔥' })
  })
})
