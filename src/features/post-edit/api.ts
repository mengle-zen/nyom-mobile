import { supabase } from '@/shared/api/supabase'
import type { MealSlotKey } from '@/entities/post'
import type { PostBatchRef } from '@/entities/post/model'

/**
 * 끼니(meal_slot) 사후 변경.
 *
 * 왜 `update_post_batch` RPC를 쓰지 않는가:
 *   RPC 시그니처는 `(p_post_id, p_group_ids, p_caption, p_recorded_at)`뿐이라
 *   **끼니를 받지 않는다**(로컬 DB의 pg_proc으로도 확인). 그래서 웹에서는 잘못
 *   분류된 끼니를 영영 고칠 수 없었다(docs/UX_FINDINGS.md C항 — 새벽 라면이
 *   "아침"으로 남는 문제). RPC 수정은 이번 작업 범위 밖이라 손대지 않았다.
 *
 * 대신 RLS가 이미 허용하는 경로로 처리한다: `posts_all_own` 정책이
 * `for all using (auth.uid() = user_id)`라 본인 게시물의 update는 그대로 가능하다.
 * 스키마도 RPC도 바꾸지 않는다.
 *
 * 호출 순서가 중요하다 — **RPC보다 먼저** 실행해야 한다. RPC가 새로 추가된 그룹에
 * 행을 insert할 때 대표 행(v_rep)의 meal_slot을 복사하므로, 끼니를 먼저 바꿔두면
 * 새 그룹 행도 바뀐 끼니로 들어간다.
 *
 * 한계(정직하게 남김): RPC와 별개의 statement라 둘이 한 트랜잭션이 아니다.
 * 끼니 update가 성공하고 RPC가 실패하면 끼니만 반영된 상태로 남는다. 되돌릴 수
 * 없는 손실은 아니고(다시 저장하면 됨) 화면도 재조회하면 실제 값을 보여준다.
 * 원자성이 필요하면 RPC에 `p_meal_slot`을 추가하는 것이 옳은 해법이다.
 */
export async function updatePostBatchMealSlot(
  userId: string,
  ref: PostBatchRef,
  mealSlot: MealSlotKey,
): Promise<void> {
  const base = supabase
    .from('posts')
    // supabase-js 2.106 generic 추론 우회. 런타임 안전.
    .update({ meal_slot: mealSlot } as never)
    .eq('user_id', userId)

  // batch_id가 있으면 batch 전체(여러 그룹 행)에, 없으면(단일/기존 행) 자기 행에.
  // fetchPostBatch·dedupe·RPC가 쓰는 `coalesce(batch_id, id)` 규칙과 같다.
  const { error } = ref.batch_id
    ? await base.eq('batch_id', ref.batch_id)
    : await base.eq('id', ref.id)

  if (error) throw error
}
