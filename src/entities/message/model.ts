import { supabase } from '@/shared/api/supabase'
import { MESSAGE_PAGE_SIZE, type QuotedPost, type RoomMessage } from './types'

// 자기 참조라 테이블 이름(`room_messages!…`)으로 걸면 반대쪽(이 메시지에 달린 답장들)이 온다.
// FK 컬럼 이름으로 걸어야 원래 메시지 하나가 온다.
const SELECT = `
  id, group_id, user_id, content, created_at, is_reply, is_message_reply,
  post:posts ( id, user_id, image_url, recorded_at, created_at ),
  reply_to:reply_to_id ( id, user_id, content )
`

type Raw = Omit<RoomMessage, 'post'> & { post: Omit<QuotedPost, 'signedImageUrl'> | null }

/** 인용 기록 사진에 서명 URL을 붙인다. 배치 요청 1번. */
async function withSignedPosts(rows: Raw[]): Promise<RoomMessage[]> {
  const paths = [...new Set(rows.flatMap((r) => (r.post ? [r.post.image_url] : [])))]
  const urls = new Map<string, string>()
  if (paths.length > 0) {
    const { data } = await supabase.storage.from('meal-photos').createSignedUrls(paths, 3600)
    data?.forEach((d, i) => {
      if (d.signedUrl) urls.set(paths[i], d.signedUrl)
    })
  }
  return rows.map((r) => ({
    ...r,
    post: r.post ? { ...r.post, signedImageUrl: urls.get(r.post.image_url) ?? null } : null,
  }))
}

/** 최신순으로 한 페이지. `before`(created_at)를 주면 그보다 오래된 것만. */
export async function fetchRoomMessages(
  groupId: string,
  before?: string,
): Promise<RoomMessage[]> {
  let query = supabase
    .from('room_messages')
    .select(SELECT)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw error
  return withSignedPosts((data ?? []) as unknown as Raw[])
}

/** 실시간으로 들어온 메시지 하나를 인용 기록까지 붙여 다시 읽는다. */
export async function fetchRoomMessage(id: string): Promise<RoomMessage | null> {
  const { data, error } = await supabase.from('room_messages').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [message] = await withSignedPosts([data as unknown as Raw])
  return message
}

export async function sendRoomMessage(params: {
  groupId: string
  userId: string
  content: string
  /** 기록에 답장할 때만 */
  postId?: string | null
  /** 다른 메시지에 답장할 때만 */
  replyToId?: string | null
}): Promise<RoomMessage> {
  const { data, error } = await supabase
    .from('room_messages')
    // supabase-js 2.106 generic 추론 우회
    .insert({
      group_id: params.groupId,
      user_id: params.userId,
      content: params.content.trim(),
      post_id: params.postId ?? null,
      is_reply: !!params.postId,
      reply_to_id: params.replyToId ?? null,
      is_message_reply: !!params.replyToId,
    } as never)
    .select(SELECT)
    .single()
  if (error) throw error
  const [message] = await withSignedPosts([data as unknown as Raw])
  return message
}

export async function deleteRoomMessage(id: string): Promise<void> {
  const { error } = await supabase.from('room_messages').delete().eq('id', id)
  if (error) throw error
}

export async function markRoomRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_room_read', { p_group_id: groupId } as never)
  if (error) throw error
}

/** 안 읽은 메시지가 있는 방 id 집합 */
export async function fetchRoomUnread(groupIds: string[]): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('room_unread', { p_group_ids: groupIds } as never)
  if (error) throw error
  const rows = (data ?? []) as { group_id: string; has_unread: boolean }[]
  return new Set(rows.filter((r) => r.has_unread).map((r) => r.group_id))
}
