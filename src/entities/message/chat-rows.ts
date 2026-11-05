import { hhmmFromDate } from '@/entities/post/date-range'
import { MESSAGE_MAX_LENGTH, type QuotedPost, type RepliedMessage, type RoomMessage } from './types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export type ChatRow =
  | { type: 'day'; key: string; label: string }
  | {
      type: 'message'
      key: string
      message: RoomMessage
      /** 이름·아바타를 보일지. 같은 사람이 같은 날 이어 보내면 첫 메시지에만. */
      showAuthor: boolean
    }

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** 날짜 구분 줄 문구 — 「오늘」·「어제」·「11월 2일 (일)」, 해가 다르면 연도까지. */
export function chatDayLabel(date: Date, now: Date): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((start(now) - start(date)) / 86_400_000)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  const md = `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`
  return date.getFullYear() === now.getFullYear() ? md : `${date.getFullYear()}년 ${md}`
}

/**
 * 최신순 메시지 → 뒤집힌(inverted) 목록의 행.
 *
 * 뒤집힌 목록은 배열 앞쪽이 화면 아래다. 그래서 날짜 구분 줄은 그날의 **가장 오래된**
 * 메시지 뒤(=화면에서 그 위)에 끼운다.
 */
export function buildChatRows(messages: RoomMessage[], now: Date): ChatRow[] {
  const rows: ChatRow[] = []
  messages.forEach((message, i) => {
    const date = new Date(message.created_at)
    const older = messages[i + 1]
    const olderDate = older ? new Date(older.created_at) : null
    const newDay = !olderDate || dayKey(olderDate) !== dayKey(date)
    rows.push({
      type: 'message',
      key: message.id,
      message,
      showAuthor: newDay || older.user_id !== message.user_id,
    })
    if (newDay) rows.push({ type: 'day', key: `day-${dayKey(date)}`, label: chatDayLabel(date, now) })
  })
  return rows
}

/**
 * 답장 인용 카드 문구. 지운 기록이면 「지운 기록」.
 * 기록 주인을 알 수 없으면(방을 나감) 「나간 친구의 …」.
 */
export function quoteLabel(
  message: Pick<RoomMessage, 'is_reply' | 'post'>,
  currentUserId: string,
  nicknameOf: (userId: string) => string | null,
): string | null {
  if (!message.is_reply) return null
  const post: QuotedPost | null = message.post
  if (!post) return '지운 기록'
  const time = hhmmFromDate(new Date(post.recorded_at))
  if (post.user_id === currentUserId) return `내 ${time} 기록`
  return `${nicknameOf(post.user_id) ?? '나간 친구'}의 ${time} 기록`
}

/** 메시지 답장의 머리말 — 「수진에게 답장」·「나에게 답장」. 방을 나간 사람이면 「나간 친구에게 답장」. */
export function replyTargetName(
  target: Pick<RepliedMessage, 'user_id'>,
  currentUserId: string,
  nicknameOf: (userId: string) => string | null,
): string {
  const name = target.user_id === currentUserId ? '나' : (nicknameOf(target.user_id) ?? '나간 친구')
  return `${name}에게 답장`
}

/**
 * 말풍선 안 메시지 답장 인용. 원문이 지워졌으면 머리말 없이 「지운 메시지」.
 * 답장이 아니면 null.
 */
export function replyQuote(
  message: Pick<RoomMessage, 'is_message_reply' | 'reply_to'>,
  currentUserId: string,
  nicknameOf: (userId: string) => string | null,
): { title: string | null; text: string } | null {
  if (!message.is_message_reply) return null
  const target = message.reply_to
  if (!target) return { title: null, text: '지운 메시지' }
  return { title: replyTargetName(target, currentUserId, nicknameOf), text: target.content }
}

/** 보낼 수 있는 내용인가 — 공백만은 안 되고 최대 1000자. */
export function canSendMessage(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= MESSAGE_MAX_LENGTH
}

/** 무한 스크롤 캐시(최신 페이지가 먼저)에 새 메시지를 넣는다. 이미 있으면 그대로. */
export function insertMessage(pages: RoomMessage[][], message: RoomMessage): RoomMessage[][] {
  if (pages.some((page) => page.some((m) => m.id === message.id))) return pages
  const [first = [], ...rest] = pages
  // 실시간 이벤트와 보내기 응답의 순서가 뒤바뀔 수 있어 시각순으로 끼운다.
  const merged = [...first, message].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return [merged, ...rest]
}

/**
 * 지운 메시지를 빼고, 그 메시지에 단 답장은 「지운 메시지」로 바꾼다.
 * 서버는 reply_to_id를 null로 바꾸지만 그 update는 실시간으로 받지 않는다.
 */
export function removeMessage(pages: RoomMessage[][], id: string): RoomMessage[][] {
  return pages.map((page) =>
    page.flatMap((m) => {
      if (m.id === id) return []
      return m.reply_to?.id === id ? [{ ...m, reply_to: null }] : [m]
    }),
  )
}
