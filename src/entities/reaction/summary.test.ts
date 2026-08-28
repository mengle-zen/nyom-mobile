import { describe, it, expect } from 'vitest'
import { summarizeReactions, myReactionEmoji, REACTION_EMOJIS } from './summary'

const r = (user_id: string, emoji: string) => ({ user_id, emoji })

describe('summarizeReactions', () => {
  it('리액션이 없으면 빈 배열 — 카운트 0인 칩을 만들지 않는다', () => {
    expect(summarizeReactions([], 'me')).toEqual([])
  })

  it('카운트가 있는 이모지만 돌려준다', () => {
    const out = summarizeReactions([r('a', '🔥')], 'me')
    expect(out).toEqual([{ emoji: '🔥', count: 1, mine: false }])
    expect(out.some((c) => c.count === 0)).toBe(false)
    expect(out.length).toBeLessThan(REACTION_EMOJIS.length)
  })

  it('같은 이모지를 합산한다', () => {
    const out = summarizeReactions([r('a', '❤️'), r('b', '❤️')], 'me')
    expect(out).toEqual([{ emoji: '❤️', count: 2, mine: false }])
  })

  it('내 리액션에 mine 플래그를 세운다', () => {
    const out = summarizeReactions([r('me', '😂'), r('a', '🔥')], 'me')
    expect(out.find((c) => c.emoji === '😂')?.mine).toBe(true)
    expect(out.find((c) => c.emoji === '🔥')?.mine).toBe(false)
  })

  it('카운트 내림차순으로 정렬한다', () => {
    const out = summarizeReactions(
      [r('a', '😂'), r('b', '🔥'), r('c', '🔥'), r('d', '🔥')],
      'me',
    )
    expect(out.map((c) => c.emoji)).toEqual(['🔥', '😂'])
  })

  it('카운트가 같으면 팔레트 순서를 따른다', () => {
    const out = summarizeReactions([r('a', '😂'), r('b', '🤤')], 'me')
    expect(out.map((c) => c.emoji)).toEqual(['🤤', '😂'])
  })

  it('팔레트에 없는 이모지는 뒤로 보낸다', () => {
    const out = summarizeReactions([r('a', '🥲'), r('b', '❤️')], 'me')
    expect(out.map((c) => c.emoji)).toEqual(['❤️', '🥲'])
  })
})

describe('myReactionEmoji', () => {
  it('내 리액션이 없으면 null', () => {
    expect(myReactionEmoji([r('a', '🔥')], 'me')).toBeNull()
    expect(myReactionEmoji([], 'me')).toBeNull()
  })
  it('내 리액션 이모지를 돌려준다', () => {
    expect(myReactionEmoji([r('a', '🔥'), r('me', '❤️')], 'me')).toBe('❤️')
  })
})
