import { supabase } from '@/shared/api/supabase'
import { INBOX_DAYS, mergeInbox, type InboxItem, type InboxThumb } from './lib/feed'

/** 종류마다 최근 몇 개까지 — 2주 동안 4명 방 몇 개면 넉넉하다. */
const PER_KIND = 60

export type InboxProfile = { id: string; nickname: string; avatar_url: string | null }
export type Inbox = { items: InboxItem[]; profiles: Map<string, InboxProfile> }

type PostRow = {
  id: string
  user_id: string
  group_id: string
  image_url: string
  meal_tag: string | null
  created_at: string
}

const thumbOf = (post: Pick<PostRow, 'image_url'> | null): InboxThumb | null =>
  post ? { image_url: post.image_url, signedImageUrl: null } : null

/**
 * 알림 목록 — 최근 2주의 친구 기록, 내 기록에 달린 리액션, 내 기록·메시지에 단 답장.
 *
 * 서버에 알림을 따로 쌓지 않고 이미 있는 데이터를 모은다(2026-11-05 시안 A). 모두 RLS를
 * 거쳐 내 방 것만 온다. 일반 채팅 메시지는 대화방의 안 읽음 점이 맡아 넣지 않는다.
 * 푸시를 꺼 둔 종류도 여기에는 보인다.
 */
export async function fetchInbox(userId: string, groupIds: string[], now: Date): Promise<Inbox> {
  if (groupIds.length === 0) return { items: [], profiles: new Map() }
  const since = new Date(now.getTime() - INBOX_DAYS * 86_400_000).toISOString()

  const [posts, reactions, postReplies, messageReplies] = await Promise.all([
    supabase
      .from('posts')
      .select('id, user_id, group_id, image_url, meal_tag, created_at')
      .in('group_id', groupIds)
      .neq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PER_KIND),
    supabase
      .from('reactions')
      .select('emoji, user_id, created_at, post:posts!inner ( id, user_id, group_id, image_url, meal_tag, created_at )')
      .eq('post.user_id', userId)
      .neq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PER_KIND),
    supabase
      .from('room_messages')
      .select('id, user_id, group_id, content, created_at, post:posts!inner ( id, user_id, image_url, meal_tag, created_at )')
      .eq('post.user_id', userId)
      .neq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PER_KIND),
    // 자기 참조는 FK 컬럼 이름으로 걸어야 원래 메시지 쪽이 온다(entities/message/model.ts).
    supabase
      .from('room_messages')
      .select('id, user_id, group_id, content, created_at, reply_to:reply_to_id!inner ( user_id )')
      .eq('reply_to.user_id', userId)
      .neq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PER_KIND),
  ])
  for (const r of [posts, reactions, postReplies, messageReplies]) if (r.error) throw r.error

  const postItems: InboxItem[] = ((posts.data ?? []) as PostRow[]).map((p) => ({
    key: `post:${p.id}`,
    kind: 'post',
    actorId: p.user_id,
    groupId: p.group_id,
    createdAt: p.created_at,
    postCreatedAt: p.created_at,
    mealTag: p.meal_tag,
    emoji: null,
    content: null,
    target: null,
    thumb: thumbOf(p),
  }))

  type ReactionRow = { emoji: string; user_id: string; created_at: string; post: PostRow }
  const reactionItems: InboxItem[] = ((reactions.data ?? []) as unknown as ReactionRow[]).map((r) => ({
    key: `reaction:${r.post.id}:${r.user_id}`,
    kind: 'reaction',
    actorId: r.user_id,
    groupId: r.post.group_id,
    createdAt: r.created_at,
    postCreatedAt: r.post.created_at,
    mealTag: r.post.meal_tag,
    emoji: r.emoji,
    content: null,
    target: null,
    thumb: thumbOf(r.post),
  }))

  type ReplyRow = {
    id: string
    user_id: string
    group_id: string
    content: string
    created_at: string
    post?: Omit<PostRow, 'group_id'>
  }
  const replyItem = (m: ReplyRow, target: 'post' | 'message'): InboxItem => ({
    key: `reply:${m.id}`,
    kind: 'reply',
    actorId: m.user_id,
    groupId: m.group_id,
    createdAt: m.created_at,
    postCreatedAt: null,
    mealTag: m.post?.meal_tag ?? null,
    emoji: null,
    content: m.content,
    target,
    thumb: thumbOf(m.post ?? null),
  })
  const replyItems = [
    ...((postReplies.data ?? []) as unknown as ReplyRow[]).map((m) => replyItem(m, 'post')),
    ...((messageReplies.data ?? []) as unknown as ReplyRow[]).map((m) => replyItem(m, 'message')),
  ]

  const items = mergeInbox(postItems, reactionItems, replyItems)

  // 썸네일 서명 URL(배치 1번)과 보낸 사람 프로필(1번)
  const paths = [...new Set(items.flatMap((i) => (i.thumb ? [i.thumb.image_url] : [])))]
  const actorIds = [...new Set(items.map((i) => i.actorId))]
  const [signed, profiles] = await Promise.all([
    paths.length > 0
      ? supabase.storage.from('meal-photos').createSignedUrls(paths, 3600)
      : Promise.resolve({ data: [] as { signedUrl: string | null }[] }),
    actorIds.length > 0
      ? supabase.from('profiles').select('id, nickname, avatar_url').in('id', actorIds)
      : Promise.resolve({ data: [] as InboxProfile[], error: null }),
  ])
  const urls = new Map<string, string>()
  signed.data?.forEach((d, i) => {
    if (d.signedUrl) urls.set(paths[i], d.signedUrl)
  })
  for (const item of items) {
    if (item.thumb) item.thumb.signedImageUrl = urls.get(item.thumb.image_url) ?? null
  }

  return {
    items,
    profiles: new Map(((profiles.data ?? []) as InboxProfile[]).map((p) => [p.id, p])),
  }
}
