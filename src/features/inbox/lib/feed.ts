import { hhmmFromDate } from '@/entities/post/date-range'

/** 모아 보는 기간 — 보드가 다루는 최근 2주와 같다. */
export const INBOX_DAYS = 14

export type InboxKind = 'post' | 'reaction' | 'reply'
export type InboxFilter = 'all' | InboxKind

/** 사진 썸네일 — 서명 URL은 따로 붙인다 */
export type InboxThumb = { image_url: string; signedImageUrl: string | null }

/**
 * 알림 목록 한 줄. 서버에 따로 쌓지 않고 기록·리액션·채팅에서 모은다.
 * - post: 친구가 기록을 올림
 * - reaction: 내 기록에 리액션
 * - reply: 내 기록(target 'post') 또는 내 메시지(target 'message')에 답장
 */
export type InboxItem = {
  /** 목록 key. 종류마다 원본 id가 겹치지 않게 접두어를 붙인다 */
  key: string
  kind: InboxKind
  actorId: string
  groupId: string
  createdAt: string
  /** 누르면 갈 날 — 기록이 올라간 날(보드는 created_at으로 묶는다). 답장은 대화방으로 가서 없다 */
  postCreatedAt: string | null
  mealTag: string | null
  emoji: string | null
  content: string | null
  target: 'post' | 'message' | null
  thumb: InboxThumb | null
}

/** 최신순으로 합친다. 같은 key는 하나만. */
export function mergeInbox(...lists: InboxItem[][]): InboxItem[] {
  const seen = new Set<string>()
  return lists
    .flat()
    .filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function filterInbox(items: InboxItem[], filter: InboxFilter): InboxItem[] {
  return filter === 'all' ? items : items.filter((item) => item.kind === filter)
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
}

/** 목록을 나누는 머리말 — 오늘 · 어제 · 이번 주(2~6일 전) · 지난주(7일 전부터). */
export function inboxSection(date: Date, now: Date): string {
  const days = daysAgo(date, now)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return '이번 주'
  return '지난주'
}

/** 줄 아래 시각 — 「방금」·「n분 전」·「n시간 전」(오늘), 「어제 19:42」, 「11월 3일」. */
export function inboxTime(date: Date, now: Date): string {
  const days = daysAgo(date, now)
  if (days <= 0) {
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
    if (minutes < 1) return '방금'
    if (minutes < 60) return `${minutes}분 전`
    return `${Math.floor(minutes / 60)}시간 전`
  }
  if (days === 1) return `어제 ${hhmmFromDate(date)}`
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

/** 줄 문구. 이름은 굵게 그리도록 따로 돌려준다. */
export function inboxMessage(item: InboxItem): string {
  const tag = item.mealTag ? `${item.mealTag} ` : ''
  switch (item.kind) {
    case 'post':
      return `님이 ${tag}기록을 올렸어요`
    case 'reaction':
      return `님이 내 ${tag}기록에 ${item.emoji ?? '리액션'}`
    case 'reply':
      return `님이 내 ${item.target === 'message' ? '메시지' : '기록'}에 답장: ${item.content ?? ''}`
  }
}

/** 마지막으로 알림 목록을 본 뒤에 온 것인가. 한 번도 안 봤으면 모두 새것. */
export function isUnread(item: Pick<InboxItem, 'createdAt'>, seenAt: string | null): boolean {
  return seenAt === null || item.createdAt > seenAt
}
