import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import {
  createGroup,
  fetchMyGroups,
  fetchGroupMembers,
  fetchGroupStats,
  fetchPublicGroups,
  fetchJoinRequests,
  joinByCode,
  requestToJoin,
} from './model'
import { isOptimisticGroup, makeOptimisticGroup } from './optimistic'
import type { Group, PublicGroup } from './model'

/** 내가 속한 그룹 목록 (Home/Upload/Groups 공용 — 자동 dedup) */
export function useMyGroups() {
  return useQuery({
    queryKey: queryKeys.groups.mine,
    queryFn: fetchMyGroups,
  })
}

/** 그룹 멤버 프로필 목록 */
export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: queryKeys.groups.members(groupId ?? ''),
    queryFn: () => fetchGroupMembers(groupId as string),
    enabled: !!groupId,
  })
}

/** 공개 그룹 탐색 목록 (탐색 탭 열렸을 때만) */
export function usePublicGroups(enabled = true) {
  return useQuery({
    queryKey: queryKeys.groups.public,
    queryFn: fetchPublicGroups,
    enabled,
  })
}

/** 그룹 pending 가입 요청 목록 (방장 전용) */
export function useJoinRequests(groupId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.groups.joinRequests(groupId ?? ''),
    queryFn: () => fetchJoinRequests(groupId as string),
    enabled: enabled && !!groupId,
  })
}

/** 그룹 관련 캐시 무효화 헬퍼 (mutation 성공 후 호출) */
export function useInvalidateGroups() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.groups.all })
}

/**
 * 그룹 목록 카드용 집계. 그룹 수와 무관하게 왕복 2번(멤버 · 오늘 게시물).
 *
 * 자리표시(낙관적) 그룹 id는 서버에 없으므로 걸러서 보낸다. 목록 자체보다
 * 부차적인 지표라 staleTime을 두어 탭을 왕복할 때마다 다시 긁지 않는다.
 */
export function useGroupStats(groupIds: string[]) {
  const ids = groupIds.filter((id) => !isOptimisticGroup({ id })).sort()
  return useQuery({
    queryKey: queryKeys.groups.stats(ids.join(',')),
    queryFn: () => fetchGroupStats(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
    // 그룹이 하나 늘면 키가 바뀐다. 이때 기존 카드의 지표가 뼈대로 되돌아가면
    // 목록 전체가 깜빡이므로 새 집계가 도착할 때까지 직전 값을 그대로 보여준다.
    placeholderData: keepPreviousData,
  })
}

/** 내 그룹 캐시에서 자리표시 행을 걷어내고 실제 행으로 갈아끼운다. */
function replaceOptimistic(list: Group[] | undefined, real: Group): Group[] {
  const rest = (list ?? []).filter((g) => !isOptimisticGroup(g) && g.id !== real.id)
  return [...rest, real]
}

/**
 * 그룹 생성(낙관적). 누른 즉시 목록에 자리표시가 앉고, 실패하면 롤백된다.
 * 성공 햅틱은 화면에서 준다(엔티티가 기기 피드백까지 알 필요는 없다).
 */
export function useCreateGroup(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createGroup(name),
    onMutate: async (name: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.groups.mine })
      const prev = qc.getQueryData<Group[]>(queryKeys.groups.mine)
      qc.setQueryData<Group[]>(queryKeys.groups.mine, (list) => [
        ...(list ?? []),
        makeOptimisticGroup(name, userId ?? ''),
      ])
      return { prev }
    },
    onError: (_err, _name, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.groups.mine, ctx.prev)
    },
    onSuccess: (group) => {
      qc.setQueryData<Group[]>(queryKeys.groups.mine, (list) =>
        replaceOptimistic(list, group),
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.groups.all })
    },
  })
}

/**
 * 초대코드 참여(낙관적). 코드만으로는 그룹 이름을 알 수 없으므로 이름 대신
 * '참여 중…' 자리표시를 앉힌다 — 없는 이름을 지어내 보여주는 것보다 정직하다.
 */
export function useJoinByCode(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => joinByCode(code),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.groups.mine })
      const prev = qc.getQueryData<Group[]>(queryKeys.groups.mine)
      qc.setQueryData<Group[]>(queryKeys.groups.mine, (list) => [
        ...(list ?? []),
        makeOptimisticGroup('참여 중…', userId ?? ''),
      ])
      return { prev }
    },
    onError: (_err, _code, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.groups.mine, ctx.prev)
    },
    onSuccess: (group) => {
      qc.setQueryData<Group[]>(queryKeys.groups.mine, (list) =>
        replaceOptimistic(list, group),
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.groups.all })
    },
  })
}

/** 공개 그룹 참여 요청(낙관적) — 배지가 즉시 '요청중'으로 바뀐다. */
export function useRequestToJoin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) => requestToJoin(groupId),
    onMutate: async (groupId: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.groups.public })
      const prev = qc.getQueryData<PublicGroup[]>(queryKeys.groups.public)
      qc.setQueryData<PublicGroup[]>(queryKeys.groups.public, (list) =>
        list?.map((g) =>
          g.id === groupId ? { ...g, user_status: 'requested' as const } : g,
        ),
      )
      return { prev }
    },
    onError: (_err, _groupId, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.groups.public, ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.groups.public })
    },
  })
}
