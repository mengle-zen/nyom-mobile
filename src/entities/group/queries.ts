import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import {
  fetchMyGroups,
  fetchGroupMembers,
  fetchPublicGroups,
  fetchJoinRequests,
} from './model'

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
