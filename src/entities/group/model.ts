import { supabase } from '@/shared/api/supabase'
import { dayRangeFromOffset } from '@/entities/post'
import type { Group, GroupJoinRequest } from '@/types/database'
import { buildGroupStats, type GroupStats, type MemberIdRow, type PostAuthorRow } from './stats'

export type { Group } from '@/types/database'

export type GroupMemberProfile = {
  user_id: string
  nickname: string
  avatar_url: string | null
}

export type PublicGroup = {
  id: string
  name: string
  invite_code: string
  is_public: boolean
  created_by: string
  created_at: string
  member_count: number
  user_status: 'none' | 'member' | 'requested' | 'banned'
}

export type JoinRequestWithRequester = GroupJoinRequest & {
  requester: { nickname: string; avatar_url: string | null }
}

/** 내가 속한 그룹 목록 (group_members 경유로 정확히 필터링) */
export async function fetchMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('groups(*)')
    .order('joined_at', { ascending: true })
  if (error) throw error
  type Row = { groups: Group | null }
  const seen = new Map<string, Group>()
  for (const row of (data ?? []) as unknown as Row[]) {
    if (row.groups) seen.set(row.groups.id, row.groups)
  }
  return Array.from(seen.values())
}

/** 공개 그룹 탐색 목록 (내 상태 포함) */
export async function fetchPublicGroups(): Promise<PublicGroup[]> {
  const { data, error } = await supabase.rpc('list_public_groups' as never)
  if (error) throw error
  return (data ?? []) as PublicGroup[]
}

/**
 * 그룹 목록 카드용 집계 — 그룹 수와 무관하게 왕복 2번.
 *
 * 그룹당 보드를 부르면(멤버 프로필 + 게시물 + signed URL) 목록이 무거워지므로,
 * 필요한 두 컬럼만 그룹 전체에 대해 한 번에 받아 클라이언트에서 접는다.
 * 두 테이블 모두 "내가 속한 그룹"으로 RLS가 걸려 있어 별도 RPC가 필요 없다.
 *
 * 하루 경계는 보드와 같은 기준(`created_at`, 로컬 자정)을 쓴다 — 카드가 말하는
 * "오늘 2명"과 보드를 열었을 때 채워진 타일 수가 어긋나면 지표를 못 믿는다.
 */
export async function fetchGroupStats(
  groupIds: string[],
  now: Date = new Date(),
): Promise<Record<string, GroupStats>> {
  if (groupIds.length === 0) return {}
  const { start, end } = dayRangeFromOffset(0, now)

  const [membersRes, postsRes] = await Promise.all([
    supabase.from('group_members').select('group_id, user_id').in('group_id', groupIds),
    supabase
      .from('posts')
      .select('group_id, user_id')
      .in('group_id', groupIds)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString()),
  ])

  if (membersRes.error) throw membersRes.error
  if (postsRes.error) throw postsRes.error

  return buildGroupStats(
    groupIds,
    (membersRes.data ?? []) as unknown as MemberIdRow[],
    (postsRes.data ?? []) as unknown as PostAuthorRow[],
  )
}

/** 그룹 멤버 프로필 목록 */
export async function fetchGroupMembers(
  groupId: string,
): Promise<GroupMemberProfile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, profiles!group_members_user_id_fkey ( id, nickname, avatar_url )')
    .eq('group_id', groupId)

  if (error) throw error
  type Row = {
    user_id: string
    profiles: { id: string; nickname: string; avatar_url: string | null } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    user_id: r.user_id,
    nickname: r.profiles?.nickname ?? '알 수 없음',
    avatar_url: r.profiles?.avatar_url ?? null,
  }))
}

/** 그룹의 pending 가입 요청 목록 (방장 전용) */
export async function fetchJoinRequests(
  groupId: string,
): Promise<JoinRequestWithRequester[]> {
  const { data, error } = await supabase
    .from('group_join_requests')
    .select('*, profiles!group_join_requests_requester_id_fkey(nickname, avatar_url)')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  type Row = GroupJoinRequest & {
    profiles: { nickname: string; avatar_url: string | null } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    requester: {
      nickname: r.profiles?.nickname ?? '알 수 없음',
      avatar_url: r.profiles?.avatar_url ?? null,
    },
  }))
}

/** 그룹 생성 (RPC). 생성자는 자동 가입된다. */
export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase.rpc('create_group', { p_name: name } as never)
  if (error) throw error
  return data as Group
}

export type JoinGroupError = 'NOT_FOUND' | 'ALREADY_MEMBER' | 'FULL' | 'BANNED' | 'UNKNOWN'

/** 초대코드로 가입 (RPC) */
export async function joinByCode(code: string): Promise<Group> {
  const { data, error } = await supabase.rpc('join_group_by_code', {
    p_invite_code: code,
  } as never)
  if (error) {
    const msg = error.message
    if (msg.includes('GROUP_NOT_FOUND')) throw new Error('NOT_FOUND' satisfies JoinGroupError)
    if (msg.includes('ALREADY_MEMBER')) throw new Error('ALREADY_MEMBER' satisfies JoinGroupError)
    if (msg.includes('GROUP_FULL')) throw new Error('FULL' satisfies JoinGroupError)
    if (msg.includes('BANNED')) throw new Error('BANNED' satisfies JoinGroupError)
    throw new Error('UNKNOWN' satisfies JoinGroupError)
  }
  return data as Group
}

/** 공개 그룹 참여 요청 */
export async function requestToJoin(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('request_to_join_group', {
    p_group_id: groupId,
  } as never)
  if (error) throw error
}

/** 가입 요청 수락 (방장) */
export async function approveRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_join_request', {
    p_request_id: requestId,
  } as never)
  if (error) throw error
}

/** 가입 요청 거절 (방장) */
export async function rejectRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_join_request', {
    p_request_id: requestId,
  } as never)
  if (error) throw error
}

/** 멤버 강퇴 (방장) */
export async function kickMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('kick_member', {
    p_group_id: groupId,
    p_user_id: userId,
  } as never)
  if (error) throw error
}

/** 그룹 정보 수정 (방장) */
export async function updateGroup(
  groupId: string,
  opts: { name?: string; isPublic?: boolean },
): Promise<Group> {
  const { data, error } = await supabase.rpc('update_group', {
    p_group_id: groupId,
    ...(opts.name !== undefined ? { p_name: opts.name } : {}),
    ...(opts.isPublic !== undefined ? { p_is_public: opts.isPublic } : {}),
  } as never)
  if (error) throw error
  return data as Group
}

/** 그룹 나가기 (방장이면 그룹 삭제, 마지막 멤버도 자동 삭제) */
export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_group', {
    p_group_id: groupId,
  } as never)
  if (error) throw error
}
