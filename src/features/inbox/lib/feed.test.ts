import { describe, expect, it } from 'vitest'
import {
  filterInbox,
  inboxMessage,
  inboxSection,
  inboxTime,
  isUnread,
  mergeInbox,
  type InboxItem,
} from './feed'

const NOW = new Date(2026, 10, 5, 20, 0)

function item(key: string, kind: InboxItem['kind'], at: Date, extra: Partial<InboxItem> = {}): InboxItem {
  return {
    key,
    kind,
    actorId: 'a',
    groupId: 'g',
    createdAt: at.toISOString(),
    postCreatedAt: null,
    mealTag: null,
    emoji: null,
    content: null,
    target: null,
    thumb: null,
    ...extra,
  }
}

describe('mergeInbox / filterInbox', () => {
  it('최신순으로 합치고 같은 key는 하나만', () => {
    const a = item('p:1', 'post', new Date(2026, 10, 5, 12))
    const b = item('r:1', 'reaction', new Date(2026, 10, 5, 13))
    const c = item('m:1', 'reply', new Date(2026, 10, 4, 9))
    const merged = mergeInbox([a, c], [b, a])
    expect(merged.map((i) => i.key)).toEqual(['r:1', 'p:1', 'm:1'])
    expect(filterInbox(merged, 'reaction').map((i) => i.key)).toEqual(['r:1'])
    expect(filterInbox(merged, 'all')).toHaveLength(3)
  })
})

describe('inboxSection / inboxTime', () => {
  it('오늘 · 어제 · 이번 주 · 지난주', () => {
    expect(inboxSection(new Date(2026, 10, 5, 1), NOW)).toBe('오늘')
    expect(inboxSection(new Date(2026, 10, 4, 23), NOW)).toBe('어제')
    expect(inboxSection(new Date(2026, 10, 1, 12), NOW)).toBe('이번 주')
    expect(inboxSection(new Date(2026, 9, 29, 12), NOW)).toBe('지난주')
  })
  it('방금 · n분 전 · n시간 전 · 어제 시각 · 날짜', () => {
    expect(inboxTime(new Date(2026, 10, 5, 19, 59, 40), NOW)).toBe('방금')
    expect(inboxTime(new Date(2026, 10, 5, 19, 40), NOW)).toBe('20분 전')
    expect(inboxTime(new Date(2026, 10, 5, 17, 10), NOW)).toBe('2시간 전')
    expect(inboxTime(new Date(2026, 10, 4, 19, 42), NOW)).toBe('어제 19:42')
    expect(inboxTime(new Date(2026, 10, 3, 9, 0), NOW)).toBe('11월 3일')
  })
})

describe('inboxMessage', () => {
  const at = new Date(2026, 10, 5, 12)
  it('종류마다 문구', () => {
    expect(inboxMessage(item('1', 'post', at, { mealTag: '점심' }))).toBe('님이 점심 기록을 올렸어요')
    expect(inboxMessage(item('2', 'reaction', at, { emoji: '🔥' }))).toBe('님이 내 기록에 🔥')
    expect(inboxMessage(item('3', 'reply', at, { target: 'post', content: '여기 어디야' }))).toBe(
      '님이 내 기록에 답장: 여기 어디야',
    )
    expect(inboxMessage(item('4', 'reply', at, { target: 'message', content: '떡볶이' }))).toBe(
      '님이 내 메시지에 답장: 떡볶이',
    )
  })
})

describe('isUnread', () => {
  it('본 시각 뒤에 온 것만 새것, 한 번도 안 봤으면 모두 새것', () => {
    const at = new Date(2026, 10, 5, 12).toISOString()
    expect(isUnread({ createdAt: at }, null)).toBe(true)
    expect(isUnread({ createdAt: at }, new Date(2026, 10, 5, 11).toISOString())).toBe(true)
    expect(isUnread({ createdAt: at }, new Date(2026, 10, 5, 13).toISOString())).toBe(false)
  })
})
