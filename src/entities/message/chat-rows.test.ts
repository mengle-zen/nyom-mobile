import { describe, expect, it } from 'vitest'
import {
  buildChatRows,
  canSendMessage,
  chatDayLabel,
  insertMessage,
  quoteLabel,
  removeMessage,
} from './chat-rows'
import type { RoomMessage } from './types'

const NOW = new Date(2026, 10, 3, 20, 0)

function msg(id: string, user: string, at: Date, extra: Partial<RoomMessage> = {}): RoomMessage {
  return {
    id,
    group_id: 'g',
    user_id: user,
    content: id,
    created_at: at.toISOString(),
    is_reply: false,
    post: null,
    ...extra,
  }
}

describe('chatDayLabel', () => {
  it('오늘·어제·날짜, 해가 다르면 연도까지', () => {
    expect(chatDayLabel(new Date(2026, 10, 3, 1), NOW)).toBe('오늘')
    expect(chatDayLabel(new Date(2026, 10, 2, 23), NOW)).toBe('어제')
    expect(chatDayLabel(new Date(2026, 10, 1, 12), NOW)).toBe('11월 1일 (일)')
    expect(chatDayLabel(new Date(2025, 11, 31, 12), NOW)).toBe('2025년 12월 31일 (수)')
  })
})

describe('buildChatRows', () => {
  it('최신순 메시지에서 그날의 가장 오래된 메시지 뒤에 날짜 줄을 끼운다', () => {
    const rows = buildChatRows(
      [
        msg('c', 'b', new Date(2026, 10, 3, 12, 5)),
        msg('b', 'a', new Date(2026, 10, 3, 12, 0)),
        msg('a', 'a', new Date(2026, 10, 2, 9, 0)),
      ],
      NOW,
    )
    expect(rows.map((r) => (r.type === 'day' ? r.label : r.key))).toEqual(['c', 'b', '오늘', 'a', '어제'])
  })

  it('같은 사람이 같은 날 이어 보내면 첫 메시지에만 이름을 보인다', () => {
    const rows = buildChatRows(
      [
        msg('c', 'a', new Date(2026, 10, 3, 12, 2)),
        msg('b', 'a', new Date(2026, 10, 3, 12, 1)),
        msg('a', 'b', new Date(2026, 10, 3, 12, 0)),
      ],
      NOW,
    )
    const shown = rows.flatMap((r) => (r.type === 'message' ? [[r.key, r.showAuthor]] : []))
    expect(shown).toEqual([
      ['c', false],
      ['b', true],
      ['a', true],
    ])
  })
})

describe('quoteLabel', () => {
  const post = {
    id: 'p',
    user_id: 'sujin',
    image_url: 'sujin/a.jpg',
    signedImageUrl: null,
    recorded_at: new Date(2026, 10, 3, 12, 31).toISOString(),
    created_at: new Date(2026, 10, 3, 12, 31).toISOString(),
  }
  const names = (id: string) => (id === 'sujin' ? '수진' : null)

  it('일반 메시지는 인용이 없다', () => {
    expect(quoteLabel({ is_reply: false, post: null }, 'me', names)).toBeNull()
  })
  it('남의 기록·내 기록·나간 친구의 기록', () => {
    expect(quoteLabel({ is_reply: true, post }, 'me', names)).toBe('수진의 12:31 기록')
    expect(quoteLabel({ is_reply: true, post }, 'sujin', names)).toBe('내 12:31 기록')
    expect(quoteLabel({ is_reply: true, post }, 'me', () => null)).toBe('나간 친구의 12:31 기록')
  })
  it('기록이 지워졌으면 「지운 기록」', () => {
    expect(quoteLabel({ is_reply: true, post: null }, 'me', names)).toBe('지운 기록')
  })
})

describe('canSendMessage', () => {
  it('공백만은 안 되고 1000자까지', () => {
    expect(canSendMessage('  ')).toBe(false)
    expect(canSendMessage(' 안녕 ')).toBe(true)
    expect(canSendMessage('가'.repeat(1000))).toBe(true)
    expect(canSendMessage('가'.repeat(1001))).toBe(false)
  })
})

describe('insertMessage / removeMessage', () => {
  const a = msg('a', 'u', new Date(2026, 10, 3, 12, 0))
  const b = msg('b', 'u', new Date(2026, 10, 3, 12, 1))
  const c = msg('c', 'u', new Date(2026, 10, 3, 12, 2))

  it('첫 페이지에 시각순(최신 먼저)으로 넣고 중복은 무시한다', () => {
    const pages = [[c, a]]
    expect(insertMessage(pages, b)[0].map((m) => m.id)).toEqual(['c', 'b', 'a'])
    expect(insertMessage(pages, a)).toBe(pages)
  })
  it('캐시가 비어 있어도 넣는다', () => {
    expect(insertMessage([], a)).toEqual([[a]])
  })
  it('지운 메시지는 모든 페이지에서 뺀다', () => {
    expect(removeMessage([[c], [b, a]], 'b')).toEqual([[c], [a]])
  })
})
