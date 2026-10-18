import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { notifyError } from '@/shared/lib/error'
import { toggleReaction, nextReactions } from '@/entities/reaction'
import {
  fetchBoardPosts, fetchGroupRecordedDays,
  fetchMyRecordedDays, fetchMyDayPosts,
  fetchPostBatch, updatePostBatch, deletePostBatch,
  type BoardPost, type PostBatchRef,
} from './model'
import type { MealSlotKey } from './board'

/** 특정 그룹·날짜(offset)의 보드 게시물. groupId가 없으면 비활성. */
export function useBoardPosts(groupId: string | null, offset: number) {
  return useQuery({
    queryKey: queryKeys.board(groupId ?? '', offset),
    queryFn: () => fetchBoardPosts(groupId as string, offset),
    enabled: !!groupId,
  })
}

/** 그룹의 기록일 키 집합(캘린더 점 표시용). groupId가 없으면 비활성. */
export function useGroupRecordedDays(groupId: string | null) {
  return useQuery({
    queryKey: queryKeys.recordedDays(groupId ?? ''),
    queryFn: () => fetchGroupRecordedDays(groupId as string),
    enabled: !!groupId,
  })
}

/** 회고 캘린더: 내 기록 중 해당 월(0-based)에 기록 있는 날짜 키 집합. */
export function useMyRecordedDays(
  userId: string | undefined,
  year: number,
  month: number,
) {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`
  return useQuery({
    queryKey: queryKeys.myRecordedDays(userId ?? '', ym),
    queryFn: () => fetchMyRecordedDays(userId as string, year, month),
    enabled: !!userId,
  })
}

/** 회고 캘린더: 선택일('YYYY-MM-DD')의 내 게시물(이미지 포함). */
export function useMyDayPosts(userId: string | undefined, dayKey: string | null) {
  return useQuery({
    queryKey: queryKeys.myDayPosts(userId ?? '', dayKey ?? ''),
    queryFn: () => fetchMyDayPosts(userId as string, dayKey as string),
    enabled: !!userId && !!dayKey,
  })
}

/** 사후 편집 대상 batch의 현재 상태(공유 그룹 목록 포함). post가 없으면 비활성. */
export function usePostBatch(
  userId: string | undefined,
  post: PostBatchRef | null,
) {
  const batchKey = post ? (post.batch_id ?? post.id) : ''
  return useQuery({
    queryKey: queryKeys.postBatch(userId ?? '', batchKey),
    queryFn: () => fetchPostBatch(userId as string, post as PostBatchRef),
    enabled: !!userId && !!post,
  })
}

/**
 * 기록을 만들거나 고치거나 지운 뒤의 무효화 — 빠뜨리기 쉬운 지점을 한 곳에 모았다.
 * (업로드·되돌리기도 이걸 쓴다)
 * - myPosts 프리픽스 하나로 그리드 · 게시물 수 · 월 캘린더 점 · 일 타임라인 · batch 상태
 * - 영향받은 **모든** 그룹(추가·제거·유지)의 보드와 기록일 — 제거된 그룹도 갱신해야 한다
 */
export function invalidateAfterPostEdit(
  qc: QueryClient,
  userId: string,
  affectedGroupIds: string[],
): void {
  void qc.invalidateQueries({ queryKey: queryKeys.myPosts(userId) })
  for (const groupId of affectedGroupIds) {
    void qc.invalidateQueries({ queryKey: ['board', groupId] })
    void qc.invalidateQueries({ queryKey: queryKeys.recordedDays(groupId) })
  }
}

/** batch 사후 편집(그룹 추가/제거 · 메모 · 시각 · 끼니). */
export function useUpdatePostBatch(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      postId: string
      groupIds: string[]
      caption: string | null
      recordedAt: string | null
      /** 끼니. null이면 유지 */
      mealSlot: MealSlotKey | null
      /** 무효화 대상 = 추가·제거·유지 그룹의 합집합 */
      affectedGroupIds: string[]
    }) => updatePostBatch(vars),
    onSuccess: (_data, vars) => {
      if (userId) invalidateAfterPostEdit(qc, userId, vars.affectedGroupIds)
    },
  })
}

/** batch 전체 삭제. 확인 모달을 거친 뒤에만 호출한다. */
export function useDeletePostBatch(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { postId: string; affectedGroupIds: string[] }) =>
      deletePostBatch(vars.postId),
    onSuccess: (_data, vars) => {
      if (userId) invalidateAfterPostEdit(qc, userId, vars.affectedGroupIds)
    },
  })
}

/**
 * 리액션 토글 mutation(낙관적 업데이트).
 * 반환된 함수 `react(postId, emoji)`를 호출하면:
 * - 캐시에서 현재 내 리액션으로 isActive 계산 → 서버 토글
 * - onMutate에서 board 캐시를 즉시 갱신, 실패 시 롤백
 */
export function useToggleReaction(
  groupId: string | null,
  offset: number,
  userId: string,
) {
  const qc = useQueryClient()
  const key = queryKeys.board(groupId ?? '', offset)

  const mutation = useMutation({
    mutationFn: ({ postId, emoji, isActive }: {
      postId: string; emoji: string; isActive: boolean
    }) => toggleReaction(postId, userId, emoji, isActive),
    onMutate: async ({ postId, emoji }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<BoardPost[]>(key)
      qc.setQueryData<BoardPost[]>(key, (list) =>
        list?.map((p) =>
          p.id === postId
            ? {
                ...p,
                reactions: nextReactions(
                  p.reactions, userId, emoji,
                ) as typeof p.reactions,
              }
            : p,
        ),
      )
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      // 낙관적으로 바뀐 칩이 말없이 되돌아가면 "눌렀는데 왜 없어졌지?"가 남는다.
      notifyError(err, '리액션을 남기지 못했어요')
    },
  })

  return (postId: string, emoji: string) => {
    const list = qc.getQueryData<BoardPost[]>(key)
    const target = list?.find((p) => p.id === postId)
    const isActive =
      target?.reactions.some((r) => r.user_id === userId && r.emoji === emoji) ??
      false
    mutation.mutate({ postId, emoji, isActive })
  }
}
