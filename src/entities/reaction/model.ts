import { supabase } from '@/shared/api/supabase'

/**
 * 1인 1리액션 토글을 서버에 반영한다.
 * - isActive(같은 이모지 이미 있음): 삭제
 * - 그 외: upsert (post_id,user_id 충돌 시 emoji 교체)
 */
export async function toggleReaction(
  postId: string,
  userId: string,
  emoji: string,
  isActive: boolean,
): Promise<void> {
  if (isActive) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .match({ post_id: postId, user_id: userId })
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('reactions')
    // supabase-js 2.106 generic 추론 우회
    .upsert({ post_id: postId, user_id: userId, emoji } as never, {
      onConflict: 'post_id,user_id',
    })
  if (error) throw error
}
